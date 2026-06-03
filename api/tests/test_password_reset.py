from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_reset_token, hash_reset_token, verify_password
from app.models.password_reset_token import PasswordResetToken
from app.models.refresh_token import RefreshToken
from app.models.user import User

EMAIL = "ada@example.com"
PASSWORD = "correct-horse-battery"
NEW_PASSWORD = "a-brand-new-secret"


def signup(client: TestClient, email: str = EMAIL) -> dict[str, str]:
    response = client.post(
        "/signup",
        json={"name": "Ada Lovelace", "email": email, "password": PASSWORD},
    )
    assert response.status_code == 201
    return response.json()


def request_reset(client: TestClient, email: str = EMAIL):
    return client.post("/auth/forgot-password", json={"email": email})


def latest_token_row(db: Session, email: str = EMAIL) -> PasswordResetToken:
    user = db.scalar(select(User).where(User.email == email))
    assert user is not None
    row = db.scalar(
        select(PasswordResetToken)
        .where(PasswordResetToken.user_id == user.id)
        .order_by(PasswordResetToken.created_at.desc())
    )
    assert row is not None
    return row


def issue_raw_token(db: Session, email: str = EMAIL) -> str:
    """Insert a reset token directly and return its raw value.

    The API never echoes the raw token, so tests mint one whose hash matches a
    stored row (the production path stores the same SHA-256 hash).
    """
    user = db.scalar(select(User).where(User.email == email))
    assert user is not None
    raw = create_reset_token()
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=hash_reset_token(raw),
            expires_at=datetime.now(UTC) + timedelta(minutes=15),
        )
    )
    db.commit()
    return raw


def test_forgot_password_creates_token_for_known_email(
    client: TestClient, db_session: Session
) -> None:
    signup(client)

    response = request_reset(client)

    assert response.status_code == 200
    assert "reset link" in response.json()["message"].lower()
    # A hashed token row exists; the raw token is never in the response body.
    row = latest_token_row(db_session)
    assert row.used_at is None
    assert "token" not in response.json()


def test_forgot_password_unknown_email_no_enumeration(
    client: TestClient, db_session: Session
) -> None:
    known = request_reset(client, "nobody@example.com")
    signup(client)
    found = request_reset(client, EMAIL)

    # Identical status + body whether or not the account exists.
    assert known.status_code == found.status_code == 200
    assert known.json() == found.json()
    # No token row was created for the non-existent account.
    assert db_session.scalar(select(PasswordResetToken)) is not None
    rows = db_session.scalars(select(PasswordResetToken)).all()
    assert len(rows) == 1


def test_reset_password_happy_path(client: TestClient, db_session: Session) -> None:
    signup(client)
    raw = issue_raw_token(db_session)

    response = client.post(
        "/auth/reset-password",
        json={"token": raw, "new_password": NEW_PASSWORD},
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Password updated."

    db_session.expire_all()
    user = db_session.scalar(select(User).where(User.email == EMAIL))
    assert verify_password(NEW_PASSWORD, user.password_hash)
    # Old password no longer works; new login succeeds.
    assert client.post("/login", json={"email": EMAIL, "password": PASSWORD}).status_code == 401
    assert client.post("/login", json={"email": EMAIL, "password": NEW_PASSWORD}).status_code == 200


def test_reset_password_marks_token_used_and_is_single_use(
    client: TestClient, db_session: Session
) -> None:
    signup(client)
    raw = issue_raw_token(db_session)

    first = client.post("/auth/reset-password", json={"token": raw, "new_password": NEW_PASSWORD})
    second = client.post(
        "/auth/reset-password", json={"token": raw, "new_password": "another-password-1"}
    )

    assert first.status_code == 200
    assert second.status_code == 400
    db_session.expire_all()
    assert latest_token_row(db_session).used_at is not None


def test_reset_password_rejects_expired_token(client: TestClient, db_session: Session) -> None:
    signup(client)
    raw = issue_raw_token(db_session)
    row = latest_token_row(db_session)
    row.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    db_session.commit()

    response = client.post(
        "/auth/reset-password", json={"token": raw, "new_password": NEW_PASSWORD}
    )

    assert response.status_code == 400
    assert "expired" in response.json()["detail"].lower()


def test_reset_password_rejects_unknown_token(client: TestClient) -> None:
    response = client.post(
        "/auth/reset-password",
        json={"token": "not-a-real-token", "new_password": NEW_PASSWORD},
    )

    assert response.status_code == 400


def test_reset_password_rejects_weak_password(client: TestClient, db_session: Session) -> None:
    signup(client)
    raw = issue_raw_token(db_session)

    response = client.post("/auth/reset-password", json={"token": raw, "new_password": "short"})

    assert response.status_code == 422


def test_reset_password_revokes_existing_sessions(
    client: TestClient, db_session: Session
) -> None:
    signup(client)
    tokens = client.post("/login", json={"email": EMAIL, "password": PASSWORD}).json()
    raw = issue_raw_token(db_session)

    client.post("/auth/reset-password", json={"token": raw, "new_password": NEW_PASSWORD})

    # The pre-existing refresh token can no longer be rotated.
    refresh = client.post("/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert refresh.status_code == 401
    db_session.expire_all()
    rows = db_session.scalars(select(RefreshToken)).all()
    assert all(row.revoked_at is not None for row in rows)
