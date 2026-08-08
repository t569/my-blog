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

    print("OK — boots on DATABASE_URL alone; unset credentials disable, never open.")


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
