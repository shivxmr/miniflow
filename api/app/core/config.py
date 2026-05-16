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

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
