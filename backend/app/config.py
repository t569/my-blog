"""Application configuration loaded from environment variables."""

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Query params libpq accepts but asyncpg.connect() does not — passing them
# through raises TypeError at connect time. ``sslmode`` has a direct asyncpg
# equivalent (``ssl``) with the same values, so it is renamed rather than
# dropped; the rest carry no meaning for asyncpg and are discarded.
_LIBPQ_ONLY_PARAMS = {"channel_binding", "gssencmode", "target_session_attrs"}


def normalize_database_url(url: str) -> str:
    """Accept any Postgres connection string and make it asyncpg-compatible.

    Hosted providers (Neon, Supabase, Railway, Render, Fly) all hand out a
    libpq-style URL. Rather than making every fork hand-edit it, take it
    verbatim and fix the two things SQLAlchemy's asyncpg driver rejects:

    >>> normalize_database_url("postgres://u:p@host/db?sslmode=require")
    'postgresql+asyncpg://u:p@host/db?ssl=require'

    An explicit driver (``postgresql+psycopg://``) is left alone — that is a
    deliberate choice, not a provider default.
    """
    parts = urlsplit(url)

    scheme = parts.scheme
    if scheme in ("postgres", "postgresql"):
        scheme = "postgresql+asyncpg"

    if scheme == "postgresql+asyncpg":
        params = [
            ("ssl" if key == "sslmode" else key, value)
            for key, value in parse_qsl(parts.query)
            if key not in _LIBPQ_ONLY_PARAMS
        ]
        query = urlencode(params)
    else:
        query = parts.query

    return urlunsplit((scheme, parts.netloc, parts.path, query, parts.fragment))


class Settings(BaseSettings):
    """Central configuration — values are read from .env or environment."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # --- Database ---
    # The only credential the app cannot run without. Paste any provider's
    # connection string verbatim — the validator below adapts it. Switching
    # Postgres hosts is this one value and nothing else.
    DATABASE_URL: str

    _normalize_db_url = field_validator("DATABASE_URL")(
        staticmethod(normalize_database_url)
    )

    # --- Auth ---
    # Optional so the public site boots without it. Unset = the admin API is
    # closed (401), never open — see app/auth/deps.py.
    NEXTAUTH_SECRET: str = ""

    # The owner row seed_owner.py creates, and the email the admin JWT must
    # carry to resolve to it. Must match ADMIN_EMAIL in the frontend env.
    # Default is upstream's, so his seed script behaves exactly as before.
    ADMIN_EMAIL: str = "admin@d3jusdevspace.com"

    # --- Cloudinary ---
    # Unset = image upload/delete return 503; everything else works.
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # --- HuggingFace (Embeddings) ---
    HUGGINGFACE_TOKEN: str = ""

    # --- Groq (LLM for agent pipeline) ---
    # Unset (or AGENT_ENABLED=false) = the agent pipeline never runs.
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # --- Agent pipeline ---
    # Master switch, independent of the key, so the agent can be turned off
    # without deleting credentials. Default True = upstream behaviour.
    AGENT_ENABLED: bool = True

    # --- Tavily (web search for research node) ---
    TAVILY_API_KEY: str = ""

    # --- LangFuse (observability / tracing) ---
    LANGFUSE_PUBLIC_KEY: str = ""
    LANGFUSE_SECRET_KEY: str = ""
    LANGFUSE_HOST: str = "https://cloud.langfuse.com"

    # --- Application ---
    environment: str = "development"
    cors_origins: str = "http://localhost:3000"

    # --- Local development ---
    # Read by scripts/dev_db.sh, not by the app: whether it may start (and on
    # first run create) the local Postgres container. Declared here because
    # Settings forbids unknown keys — an undeclared entry in .env is a startup
    # crash, not a warning.
    LOCAL_POSTGRES_DOCKER_FOR_DEV: bool = False
    DEV_DB_CONTAINER: str = "my-blog-pg"
    DEV_DB_IMAGE: str = "pgvector/pgvector:pg16"
    DEV_DB_PORT: int = 5432

    # --- Author identity (agent prompts) ---
    # Who the agent thinks it is ghostwriting for. Hardcoded into the topic and
    # writer prompts before; a fork must be able to change it without editing
    # them. Default is upstream's author, so behaviour is unchanged if unset.
    # The owner's bio / interests / learning focus still come from the database
    # (Settings → Context) and steer topic selection semantically — this is only
    # the one-line framing that sits above them.
    AUTHOR_PERSONA: str = (
        "a Nigerian AI/ML and software engineer with a background in "
        "mechatronics, robotics, and embedded systems"
    )

    @property
    def agent_ready(self) -> bool:
        """Whether the agent pipeline may run — switch on and key present."""
        return self.AGENT_ENABLED and bool(self.GROQ_API_KEY)

    @property
    def cloudinary_ready(self) -> bool:
        """Whether image uploads are configured."""
        return bool(
            self.CLOUDINARY_CLOUD_NAME
            and self.CLOUDINARY_API_KEY
            and self.CLOUDINARY_API_SECRET
        )

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.cors_origins.split(",")]


settings = Settings()  # type: ignore[call-arg]
