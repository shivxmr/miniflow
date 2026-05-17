"""Auth-route rate limiting.

The limiter is disabled for the rest of the suite (see conftest); these tests
enable it explicitly and reset its storage so they stay isolated.
"""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from app.core.limiter import limiter


@pytest.fixture
def rate_limited() -> Generator[None]:
    limiter.enabled = True
    limiter.reset()
    try:
        yield
    finally:
        limiter.enabled = False
        limiter.reset()


def test_login_is_rate_limited(client: TestClient, rate_limited: None) -> None:
    statuses = [
        client.post(
            "/login",
            json={"email": "nobody@example.com", "password": "wrong-password"},
        ).status_code
        for _ in range(15)
    ]

    # Early attempts are handled normally (401 for bad credentials)...
    assert statuses[0] == 401
    # ...but the per-IP allowance is eventually exhausted.
    assert 429 in statuses


def test_signup_is_rate_limited(client: TestClient, rate_limited: None) -> None:
    statuses = [
        client.post(
            "/signup",
            json={
                "name": "Rate Test",
                "email": f"rate{i}@example.com",
                "password": "correct-horse-battery",
            },
        ).status_code
        for i in range(15)
    ]

    assert statuses[0] == 201
    assert 429 in statuses
