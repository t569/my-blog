"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration — values are read from .env or environment."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # --- Database ---
    DATABASE_URL: str

    # --- Auth ---
    NEXTAUTH_SECRET: str
    # Signs draft preview links. Its own secret, so rotating it cancels every
    # outstanding link without signing the admin out. Unset = previews off.
    PREVIEW_SECRET: str = ""

    # --- Cloudinary ---
    CLOUDINARY_CLOUD_NAME: str
    CLOUDINARY_API_KEY: str
    CLOUDINARY_API_SECRET: str

    # --- HuggingFace (Embeddings) ---
    HUGGINGFACE_TOKEN: str = ""

    # --- Groq (LLM for agent pipeline) ---
    GROQ_API_KEY: str
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # --- Tavily (web search for research node) ---
    TAVILY_API_KEY: str = ""

    # --- LangFuse (observability / tracing) ---
    LANGFUSE_PUBLIC_KEY: str = ""
    LANGFUSE_SECRET_KEY: str = ""
    LANGFUSE_HOST: str = "https://cloud.langfuse.com"

    # --- Application ---
    environment: str = "development"
    cors_origins: str = "http://localhost:3000"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.cors_origins.split(",")]


settings = Settings()  # type: ignore[call-arg]
