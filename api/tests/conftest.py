from collections.abc import Generator

import psycopg
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

from app.core.database import Base, get_db
from app.main import app
from app.models import RefreshToken  # noqa: F401

TEST_DATABASE_URL = "postgresql+psycopg://miniflow:miniflow@localhost:5432/miniflow_test"


def _ensure_test_database() -> None:
    url = make_url(TEST_DATABASE_URL)
    admin_url = url.set(database="postgres").render_as_string(hide_password=False)

    with psycopg.connect(admin_url.replace("postgresql+psycopg", "postgresql")) as conn:
        conn.autocommit = True
        exists = conn.execute(
            "select 1 from pg_database where datname = %s",
            (url.database,),
        ).fetchone()
        if not exists:
            conn.execute(f'create database "{url.database}"')


@pytest.fixture
def db_session() -> Generator[Session]:
    _ensure_test_database()
    engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient]:
    def override_get_db() -> Generator[Session]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
