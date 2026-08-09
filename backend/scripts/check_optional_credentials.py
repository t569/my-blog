"""Self-check: the app must boot with DATABASE_URL alone, and fail closed.

Run:  python -m scripts.check_optional_credentials   (from backend/)

Guards the promise made in .env.example — every credential except
DATABASE_URL is optional, and an unset credential disables its feature
rather than opening it up.
"""

import asyncio
import os
import sys
from contextlib import contextmanager


@contextmanager
def only_database_url():
    """Run with a environment holding nothing but DATABASE_URL."""
    saved = dict(os.environ)
    os.environ.clear()
    os.environ["DATABASE_URL"] = "postgresql+asyncpg://u:p@localhost/db"
    try:
        yield
    finally:
        os.environ.clear()
        os.environ.update(saved)


def main() -> None:
    with only_database_url():
        # Imported in here on purpose: app.config builds a module-level
        # Settings() at import time, so DATABASE_URL must already be set.
        # That is the whole point — it is the one required value.
        from app.config import Settings

        # _env_file=None so a developer's real .env can't mask the defaults.
        s = Settings(_env_file=None)  # type: ignore[call-arg]

    assert s.DATABASE_URL.startswith("postgresql"), "DATABASE_URL stays required"
    assert s.NEXTAUTH_SECRET == "", "auth secret must be optional"
    assert not s.cloudinary_ready, "no keys ⇒ uploads disabled"
    assert not s.agent_ready, "no Groq key ⇒ agent disabled"

    # The switch is independent of the key, in both directions.
    assert not Settings(
        _env_file=None, DATABASE_URL="x", GROQ_API_KEY="k", AGENT_ENABLED=False
    ).agent_ready, "AGENT_ENABLED=false must win over a present key"
    assert Settings(
        _env_file=None, DATABASE_URL="x", GROQ_API_KEY="k"
    ).agent_ready, "key + default switch ⇒ agent runs (upstream behaviour)"

    # Partial Cloudinary config is not config.
    assert not Settings(
        _env_file=None, DATABASE_URL="x", CLOUDINARY_CLOUD_NAME="c"
    ).cloudinary_ready, "partial Cloudinary credentials must not count as ready"

    _check_auth_fails_closed()
    _check_database_url_normalization()
    _check_feature_resolution()

    print("OK — boots on DATABASE_URL alone; unset credentials disable, never open.")


def _check_feature_resolution() -> None:
    """A feature runs only when credentials allow it AND the owner wants it."""
    from app.config import Settings
    from app.services.feature_service import (
        BY_ID,
        REGISTRY,
        is_available,
        is_effective,
    )

    bare = Settings(_env_file=None, DATABASE_URL="x")  # type: ignore[call-arg]
    full = Settings(  # type: ignore[call-arg]
        _env_file=None,
        DATABASE_URL="x",
        GROQ_API_KEY="k",
        HUGGINGFACE_TOKEN="k",
        CLOUDINARY_CLOUD_NAME="c",
        CLOUDINARY_API_KEY="k",
        CLOUDINARY_API_SECRET="s",
    )

    for feature in REGISTRY:
        # A feature that names no credentials and no master switch has nothing
        # to be unavailable *for* — it is a preference, not a capability, so it
        # is always available and only the owner's switch decides. Asserting
        # otherwise would forbid that whole category from ever existing.
        gated = bool(feature.requires) or feature.switch is not None
        if gated:
            assert not is_available(feature, bare), (
                f"{feature.id} available with no keys"
            )
        else:
            assert is_available(feature, bare), (
                f"{feature.id} gates on nothing, so it must always be available"
            )
        assert is_available(feature, full), f"{feature.id} unavailable with all keys"

        # An untouched switch falls back to the feature's own default. It is on
        # for everything that predates `default_enabled`, so an install that
        # never touched the switches behaves exactly as upstream does.
        assert (
            is_effective(feature, {}, full) is feature.default_enabled
        ), f"{feature.id} untouched must resolve to default_enabled"

        assert not is_effective(feature, {feature.id: False}, full), (
            f"{feature.id} switch must turn it off"
        )
        assert is_effective(feature, {feature.id: True}, full), (
            f"{feature.id} switch must turn it on"
        )
        # A switch cannot conjure a feature whose credentials are missing.
        if gated:
            assert not is_effective(feature, {feature.id: True}, bare), (
                f"{feature.id} enabled without credentials"
            )

    # Partial Cloudinary credentials are not credentials.
    partial = Settings(  # type: ignore[call-arg]
        _env_file=None, DATABASE_URL="x", CLOUDINARY_CLOUD_NAME="c"
    )
    assert not is_available(BY_ID["uploads"], partial), "partial config counted as ready"

    # The agent's env master switch still wins over both the key and the flag.
    off = Settings(  # type: ignore[call-arg]
        _env_file=None, DATABASE_URL="x", GROQ_API_KEY="k", AGENT_ENABLED=False
    )
    assert not is_effective(BY_ID["agent"], {"agent": True}, off), (
        "AGENT_ENABLED=false must win over the owner's switch"
    )


def _check_database_url_normalization() -> None:
    """Any provider's connection string must work pasted verbatim."""
    from app.config import normalize_database_url as norm

    # Real shapes handed out by each provider's dashboard.
    cases = {
        # Neon
        "postgresql://u:p@ep-x.neon.tech/neondb?sslmode=require&channel_binding=require":
            "postgresql+asyncpg://u:p@ep-x.neon.tech/neondb?ssl=require",
        # Supabase / Render — note the bare "postgres" scheme
        "postgres://u:p@db.abc.supabase.co:5432/postgres?sslmode=require":
            "postgresql+asyncpg://u:p@db.abc.supabase.co:5432/postgres?ssl=require",
        # Railway / plain local — nothing to strip
        "postgresql://u:p@localhost:5432/blog":
            "postgresql+asyncpg://u:p@localhost:5432/blog",
        # Already correct — must be a no-op, not double-applied
        "postgresql+asyncpg://u:p@host/db?ssl=require":
            "postgresql+asyncpg://u:p@host/db?ssl=require",
    }
    for given, expected in cases.items():
        assert norm(given) == expected, f"{given}\n  got:  {norm(given)}\n  want: {expected}"

    # An explicitly chosen non-asyncpg driver is a deliberate choice: leave it.
    sync = "postgresql+psycopg://u:p@host/db?sslmode=require"
    assert norm(sync) == sync, "explicit driver must not be rewritten"

    # Passwords with URL-encoded specials must survive the round-trip.
    encoded = "postgresql://u:p%40ss%2Fword@host/db?sslmode=require"
    assert "p%40ss%2Fword" in norm(encoded), "encoded password was mangled"


def _check_auth_fails_closed() -> None:
    """A blank secret must reject tokens, not verify them against ""."""
    import jwt
    from fastapi import HTTPException

    from app.auth.deps import get_current_admin
    from app.config import settings

    forged = jwt.encode({"email": "attacker@example.com"}, "", algorithm="HS256")

    class _Creds:
        credentials = forged

    saved = settings.NEXTAUTH_SECRET
    settings.NEXTAUTH_SECRET = ""
    try:
        # db=None is safe: the guard runs before any database access. If that
        # ordering ever changes, this raises AttributeError and the check fails.
        asyncio.run(get_current_admin(_Creds(), None))  # type: ignore[arg-type]
    except HTTPException as exc:
        assert exc.status_code == 401, f"expected 401, got {exc.status_code}"
    else:
        raise AssertionError("blank NEXTAUTH_SECRET accepted a forged token")
    finally:
        settings.NEXTAUTH_SECRET = saved


if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    main()
