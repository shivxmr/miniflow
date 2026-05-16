from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.models.refresh_token import RefreshToken
from app.models.user import User


def signup_payload(email: str = "ada@example.com") -> dict[str, str]:
    return {
        "name": "Ada Lovelace",
        "email": email,
        "password": "correct-horse-battery",
    }


def signup(client: TestClient, email: str = "ada@example.com") -> dict[str, str]:
    response = client.post("/signup", json=signup_payload(email=email))
    assert response.status_code == 201
    return response.json()


def login(client: TestClient, email: str = "ada@example.com") -> dict[str, str]:
    response = client.post(
        "/login",
        json={"email": email, "password": "correct-horse-battery"},
    )
    assert response.status_code == 200
    return response.json()


def test_signup_creates_user_with_bcrypt_hash(client: TestClient, db_session: Session) -> None:
    data = signup(client)

    assert data["email"] == "ada@example.com"
    assert data["role"] == "member"
    assert "password" not in data

    user = db_session.scalar(select(User).where(User.email == "ada@example.com"))
    assert user is not None
    assert user.password_hash != "correct-horse-battery"
    assert user.password_hash.startswith("$2")


def test_duplicate_email_rejected(client: TestClient) -> None:
    signup(client)

    response = client.post("/signup", json=signup_payload())

    assert response.status_code == 409
    assert response.json() == {"detail": "Email is already registered"}


def test_login_success_and_me_with_valid_token(client: TestClient) -> None:
    signup(client)

    tokens = login(client)
    response = client.get(
        "/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )

    assert tokens["token_type"] == "bearer"
    assert tokens["access_token"]
    assert tokens["refresh_token"]
    assert response.status_code == 200
    assert response.json()["email"] == "ada@example.com"


def test_login_wrong_password_uses_generic_error(client: TestClient) -> None:
    signup(client)

    response = client.post(
        "/login",
        json={"email": "ada@example.com", "password": "wrong-password"},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid email or password"}


def test_me_rejects_missing_tampered_and_expired_tokens(client: TestClient) -> None:
    signup(client)
    tokens = login(client)

    missing = client.get("/me")
    tampered = client.get(
        "/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}tampered"},
    )
    expired_token = create_access_token(
        subject="00000000-0000-0000-0000-000000000000",
        expires_delta=timedelta(minutes=-1),
    )
    expired = client.get("/me", headers={"Authorization": f"Bearer {expired_token}"})

    assert missing.status_code == 401
    assert tampered.status_code == 401
    assert expired.status_code == 401


def test_refresh_rotates_refresh_token(client: TestClient, db_session: Session) -> None:
    signup(client)
    tokens = login(client)

    response = client.post("/refresh", json={"refresh_token": tokens["refresh_token"]})

    assert response.status_code == 200
    rotated = response.json()
    assert rotated["access_token"]
    assert rotated["refresh_token"] != tokens["refresh_token"]

    stored_tokens = db_session.scalars(select(RefreshToken)).all()
    assert len(stored_tokens) == 2
    assert sum(token.revoked_at is not None for token in stored_tokens) == 1

    reused = client.post("/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert reused.status_code == 401


def test_logout_revokes_refresh_token(client: TestClient) -> None:
    signup(client)
    tokens = login(client)

    logout_response = client.post(
        "/logout",
        json={"refresh_token": tokens["refresh_token"]},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    refresh_response = client.post("/refresh", json={"refresh_token": tokens["refresh_token"]})

    assert logout_response.status_code == 204
    assert refresh_response.status_code == 401
