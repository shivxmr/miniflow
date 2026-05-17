from functools import lru_cache

from pydantic import Field
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
    backend_cors_origins: str = Field(
        default="http://localhost:3000",
        alias="BACKEND_CORS_ORIGINS",
    )

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


@lru_cache
def get_settings() -> Settings:
    return Settings()
