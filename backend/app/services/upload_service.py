"""Upload service — handles image uploads to Cloudinary."""

import re

import cloudinary
import cloudinary.uploader
from fastapi import HTTPException, UploadFile, status

from app.config import settings

# Maximum upload size in bytes (20 MB).
_MAX_UPLOAD_BYTES = 20 * 1024 * 1024

# Maximum image width in pixels — Cloudinary will downscale on upload.
_MAX_IMAGE_WIDTH = 1600

# Allowed image MIME types.
_ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/avif",
}

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


def _require_cloudinary() -> None:
    """Reject image operations when Cloudinary credentials are unset."""
    if not settings.cloudinary_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image storage is not configured (CLOUDINARY_* unset).",
        )


async def upload_image(file: UploadFile) -> str:
    """Validate and upload an image to Cloudinary.

    Returns the secure CDN URL of the uploaded image.

    Raises:
        HTTPException(400): If the file type is unsupported or exceeds size limit.
        HTTPException(502): If the Cloudinary upload fails.
        HTTPException(503): If Cloudinary is not configured.
    """
    _require_cloudinary()

    # Validate content type.
    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {file.content_type}. "
            f"Allowed types: {', '.join(sorted(_ALLOWED_CONTENT_TYPES))}",
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
    _require_cloudinary()

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
