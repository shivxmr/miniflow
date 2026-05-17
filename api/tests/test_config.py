from app.core.config import Settings


def _settings(database_url: str) -> Settings:
    # _env_file=None ignores the local .env so the input is tested verbatim.
    return Settings(_env_file=None, DATABASE_URL=database_url)


def test_bare_postgresql_url_gets_psycopg_driver() -> None:
    settings = _settings("postgresql://user:pass@host:5432/db?sslmode=require")
    assert settings.database_url == (
        "postgresql+psycopg://user:pass@host:5432/db?sslmode=require"
    )


def test_psycopg_url_is_left_unchanged() -> None:
    url = "postgresql+psycopg://miniflow:miniflow@localhost:5432/miniflow"
    assert _settings(url).database_url == url
