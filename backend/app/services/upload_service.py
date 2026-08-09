"""Upload service — handles image uploads to Cloudinary."""

import re
from pathlib import Path

import cloudinary
import cloudinary.uploader
from fastapi import HTTPException, UploadFile, status

from app.config import settings

# Maximum upload size in bytes (20 MB).
_MAX_UPLOAD_BYTES = 20 * 1024 * 1024

# Maximum image width in pixels — Cloudinary will downscale on upload.
_MAX_IMAGE_WIDTH = 1600

# Allowed image MIME types.
#
# HEIC/HEIF are here because they are what an iPhone produces by default, and
# some Android models optionally. Cloudinary accepts and converts them, so the
# only thing that ever rejected them was this list.
_ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/avif",
    "image/heic",
    "image/heif",
}

# Types a browser sends when it does not know, which is not the same as a type
# we refuse. Windows maps extensions to MIME through the registry, so an
# unregistered extension arrives as one of these from an ordinary file picker —
# the same file can upload from one machine and fail from another.
_UNKNOWN_CONTENT_TYPES = {"", "application/octet-stream", "binary/octet-stream"}

# Fallback for those, by extension. Deliberately a separate map rather than
# guessing from the bytes: it decides what we accept, so it stays explicit.
_EXTENSION_CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".jfif": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".avif": "image/avif",
    ".heic": "image/heic",
    ".heif": "image/heif",
}


def resolve_content_type(content_type: str | None, filename: str | None) -> str | None:
    """The image type to treat this upload as, or None to refuse it.

    Trusts the browser's type when it is one we allow. When the browser says it
    does not know, falls back to the file extension — otherwise a perfectly
    ordinary PNG is refused because of a registry entry on the uploader's
    machine. A type we simply do not allow is never overridden by the
    extension; the fallback fills silence, it does not argue.

    Checked by ``python -m scripts.check_uploads``.
    """
    declared = (content_type or "").split(";")[0].strip().lower()

    if declared in _ALLOWED_CONTENT_TYPES:
        return declared

    if declared in _UNKNOWN_CONTENT_TYPES:
        suffix = Path(filename or "").suffix.lower()
        return _EXTENSION_CONTENT_TYPES.get(suffix)

    return None

# Regex to extract the public_id from a Cloudinary secure URL.
# Example: https://res.cloudinary.com/cloud/image/upload/v1234/blog/posts/abc123.jpg
#  → public_id = "blog/posts/abc123"
_PUBLIC_ID_RE = re.compile(
    r"res\.cloudinary\.com/[^/]+/image/upload/(?:v\d+/)?(.+)\.\w+$"
)

# Configure the Cloudinary SDK once at module level.
cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True,
)


async def _require_cloudinary() -> None:
    """Reject image operations when uploads are unconfigured or switched off.

    Both callers below are the only ones in the app, so the guard stays here
    rather than in the router — the 503 lives next to the code that knows why.
    Imported inside the function: feature_service imports the session factory,
    and this module is imported at startup.
    """
    from app.services import feature_service

    await feature_service.require("uploads")


async def upload_image(file: UploadFile) -> str:
    """Validate and upload an image to Cloudinary.

    Returns the secure CDN URL of the uploaded image.

    Raises:
        HTTPException(400): If the file type is unsupported or exceeds size limit.
        HTTPException(502): If the Cloudinary upload fails.
        HTTPException(503): If Cloudinary is not configured.
    """
    await _require_cloudinary()

    # Validate content type.
    if resolve_content_type(file.content_type, file.filename) is None:
        # Name what arrived, including the filename: when a browser sends no
        # type at all, "Unsupported file type: None" tells the author nothing
        # about which file it objected to.
        got = file.content_type or "no type"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type for {file.filename or 'the file'} "
            f"({got}). Allowed types: "
            f"{', '.join(sorted(_ALLOWED_CONTENT_TYPES))}.",
        )

    # Read file contents and validate size.
    contents = await file.read()

    if len(contents) > _MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size is {_MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
        )

    # Upload to Cloudinary with width-limiting transformation.
    try:
        result = cloudinary.uploader.upload(
            contents,
            folder="blog/posts",
            resource_type="image",
            transformation={"width": _MAX_IMAGE_WIDTH, "crop": "limit"},
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Image upload failed: {exc}",
        )

    return result["secure_url"]


def _extract_public_id(url: str) -> str:
    """Extract the Cloudinary public_id from a secure URL.

    Raises:
        HTTPException(400): If the URL doesn't match the expected Cloudinary format.
    """
    match = _PUBLIC_ID_RE.search(url)
    if match is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Cloudinary URL.",
        )
    return match.group(1)


async def delete_image(url: str) -> None:
    """Delete an image from Cloudinary by its URL.

    Raises:
        HTTPException(400): If the URL is not a valid Cloudinary URL.
        HTTPException(502): If the Cloudinary deletion fails.
        HTTPException(503): If Cloudinary is not configured.
    """
    await _require_cloudinary()

    public_id = _extract_public_id(url)

    try:
        result = cloudinary.uploader.destroy(public_id, resource_type="image")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Image deletion failed: {exc}",
        )

    if result.get("result") != "ok":
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Cloudinary returned: {result.get('result', 'unknown error')}",
        )
