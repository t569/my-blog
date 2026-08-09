#!/usr/bin/env python3
"""Assert which uploads are accepted, and which are refused.

Run:
    python -m scripts.check_uploads

This decides what a browser is allowed to put into the post editor, so it is
asserted rather than reasoned about. No test framework — same shape as
``scripts/check_optional_credentials.py``.
"""

from app.services.upload_service import resolve_content_type


def main() -> None:
    cases: list[tuple[str | None, str | None, str | None, str]] = [
        # (content_type, filename, expected, why)
        ("image/jpeg", "photo.jpg", "image/jpeg", "the ordinary case"),
        ("image/png", "shot.png", "image/png", "the other ordinary case"),
        (
            "image/heic",
            "IMG_0001.HEIC",
            "image/heic",
            "an iPhone's default format",
        ),
        (
            "image/jpeg; charset=binary",
            "photo.jpg",
            "image/jpeg",
            "parameters after the type are stripped",
        ),
        (
            "IMAGE/JPEG",
            "photo.jpg",
            "image/jpeg",
            "the type is case-insensitive",
        ),
        # The browser does not know. Windows maps extensions to MIME through
        # the registry, so an unregistered extension arrives like this from an
        # ordinary file picker — refusing it means the same file uploads from
        # one machine and fails from another.
        (
            "application/octet-stream",
            "diagram.png",
            "image/png",
            "unknown type falls back to the extension",
        ),
        ("", "photo.JPG", "image/jpeg", "empty type, extension in caps"),
        (None, "animation.gif", "image/gif", "no type at all"),
        (
            "application/octet-stream",
            "archive.zip",
            None,
            "the fallback does not invent an image",
        ),
        (
            "application/octet-stream",
            "noextension",
            None,
            "nothing to fall back to",
        ),
        # A type we refuse is refused. The fallback fills silence; it does not
        # overrule a browser that told us something we do not accept.
        (
            "application/pdf",
            "notes.pdf",
            None,
            "a known-but-unwanted type is not rescued by its extension",
        ),
        (
            "text/html",
            "payload.png",
            None,
            "a mislabelled extension cannot smuggle a type past the check",
        ),
        ("video/mp4", "clip.mp4", None, "not an image"),
    ]

    failures = 0
    for content_type, filename, expected, why in cases:
        actual = resolve_content_type(content_type, filename)
        ok = actual == expected
        if not ok:
            failures += 1
        print(
            f"{'ok  ' if ok else 'FAIL'}  {str(content_type):<28} "
            f"{str(filename):<18} -> {str(actual):<14} {why}"
        )

    assert failures == 0, f"{failures} upload case(s) failed"
    print(f"\nOK — {len(cases)} upload cases behave as intended.")


if __name__ == "__main__":
    main()
