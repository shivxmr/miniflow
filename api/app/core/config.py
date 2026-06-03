from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = Field(default="MiniFlow API", alias="APP_NAME")
    database_url: str = Field(
        default="postgresql+psycopg://miniflow:miniflow@localhost:5432/miniflow",
        alias="DATABASE_URL",
    )
    secret_key: str = Field(
        default="dev-only-change-me-before-deploy",
        alias="SECRET_KEY",
    )
    access_token_expire_minutes: int = Field(default=15, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_expire_days: int = Field(default=7, alias="REFRESH_TOKEN_EXPIRE_DAYS")
    password_reset_token_expire_minutes: int = Field(
        default=15, alias="PASSWORD_RESET_TOKEN_EXPIRE_MINUTES"
    )
    backend_cors_origins: str = Field(
        default="http://localhost:3000",
        alias="BACKEND_CORS_ORIGINS",
    )

    # --- Frontend & email ---
    # The web app's base URL; reset links point at ``{frontend_url}/reset-password``.
    frontend_url: str = Field(default="http://localhost:3000", alias="FRONTEND_URL")
    email_from: str = Field(default="MiniFlow <no-reply@miniflow.app>", alias="EMAIL_FROM")
    # Email delivery is pluggable: Resend if a key is set, else SMTP if a host
    # is set, else the link is logged (works out-of-the-box locally and in prod).
    resend_api_key: str = Field(default="", alias="RESEND_API_KEY")
    smtp_host: str = Field(default="", alias="SMTP_HOST")
    smtp_port: int = Field(default=587, alias="SMTP_PORT")
    smtp_user: str = Field(default="", alias="SMTP_USER")
    smtp_password: str = Field(default="", alias="SMTP_PASSWORD")

    # --- LLM (AI subtask generation) ---
    # Provider is OpenAI-compatible; OpenRouter is the default. The API key is
    # read from the environment and never committed.
    llm_provider: str = Field(default="openrouter", alias="LLM_PROVIDER")
    llm_api_key: str = Field(default="", alias="LLM_API_KEY")
    llm_model: str = Field(
        default="openai/gpt-oss-120b:free",
        alias="LLM_MODEL",
    )
    llm_base_url: str = Field(
        default="https://openrouter.ai/api/v1",
        alias="LLM_BASE_URL",
    )

    # --- Rate limiting ---
    auth_rate_limit: str = Field(default="10/minute", alias="AUTH_RATE_LIMIT")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("database_url")
    @classmethod
    def _use_psycopg_driver(cls, value: str) -> str:
        """Pin the psycopg driver on bare ``postgresql://`` URLs.

        Managed Postgres providers (Neon, Render) hand out plain
        ``postgresql://`` connection strings; SQLAlchemy needs the driver
        named explicitly. This lets such a string be pasted in verbatim.
        """
        if value.startswith("postgresql://"):
            return "postgresql+psycopg://" + value.removeprefix("postgresql://")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
