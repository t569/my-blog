"""Signed, expiring preview links for unpublished posts.

A preview token is a JWT carrying the post id, an expiry and whether the
holder may leave suggestions. Nothing is stored: the signature *is* the
grant, so a link dies on its own at ``exp``. Rotating ``PREVIEW_SECRET``
cancels every outstanding link at once, and touches nothing else.

``PREVIEW_SECRET`` is separate from ``NEXTAUTH_SECRET`` so that cancelling
links never signs the admin out. Even if the two were set equal, the token
carries ``aud="preview"``: a preview token can never pass as an admin session
and an admin session can never open a preview.
"""

import uuid
from datetime import UTC, datetime, timedelta

import jwt

from app.config import settings

_AUDIENCE = "preview"
# HS256 wants a key at least as long as its 32-byte digest; a short secret is
# brute-forceable offline from any one link, so it disables previews instead.
_MIN_SECRET_LEN = 32


def _key() -> str | None:
    # Fail closed, as get_current_admin does: no usable secret, no previews.
    secret = settings.PREVIEW_SECRET
    return secret if len(secret) >= _MIN_SECRET_LEN else None


def make_preview_token(
    post_id: uuid.UUID, hours: int, suggest: bool
) -> tuple[str, datetime] | None:
    """Return ``(token, expires_at)``, or ``None`` if previews are not configured."""
    key = _key()
    if key is None:
        return None
    expires_at = datetime.now(UTC) + timedelta(hours=hours)
    token = jwt.encode(
        {"sub": str(post_id), "aud": _AUDIENCE, "suggest": suggest, "exp": expires_at},
        key,
        algorithm="HS256",
    )
    return token, expires_at


def read_preview_token(token: str) -> tuple[uuid.UUID, bool, datetime] | None:
    """Return ``(post_id, may_suggest, expires_at)``, or ``None`` for any bad token.

    Expired, forged, malformed and wrong-audience tokens are deliberately
    indistinguishable to the caller.
    """
    key = _key()
    if key is None:
        return None
    try:
        payload = jwt.decode(
            token,
            key,
            algorithms=["HS256"],
            audience=_AUDIENCE,
            options={"require": ["exp", "sub", "aud"]},
        )
        return (
            uuid.UUID(payload["sub"]),
            payload.get("suggest") is True,
            datetime.fromtimestamp(payload["exp"], UTC),
        )
    except (jwt.InvalidTokenError, ValueError):
        return None


if __name__ == "__main__":
    # Self-check: python -m app.auth.preview (from backend/, needs .env for settings)
    settings.PREVIEW_SECRET = "s" * 32
    pid = uuid.uuid4()
    tok, _ = make_preview_token(pid, 1, True)
    assert read_preview_token(tok)[:2] == (pid, True)
    assert read_preview_token(tok + "x") is None
    assert read_preview_token(make_preview_token(pid, -1, False)[0]) is None  # expired
    # Even with the two secrets equal, an admin-style token (no aud) must not
    # open a preview, and a preview token must not pass the admin decode.
    admin = jwt.encode({"email": "a@b.c"}, settings.PREVIEW_SECRET, algorithm="HS256")
    assert read_preview_token(admin) is None
    try:
        jwt.decode(tok, settings.PREVIEW_SECRET, algorithms=["HS256"])
        raise AssertionError("preview token decoded as admin")
    except jwt.InvalidTokenError:
        pass
    settings.PREVIEW_SECRET = "short"
    assert make_preview_token(pid, 1, False) is None  # short secret = off
    print("preview tokens ok")
