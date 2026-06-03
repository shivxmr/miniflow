import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.email import send_password_reset_email
from app.core.security import (
    create_access_token,
    create_refresh_token,
    create_reset_token,
    hash_password,
    hash_refresh_token,
    hash_reset_token,
    verify_password,
)
from app.models.password_reset_token import PasswordResetToken
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import TokenPair, UserCreate


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.lower()))


def create_user(db: Session, payload: UserCreate) -> User:
    user = User(
        name=payload.name.strip(),
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = get_user_by_email(db, email)
    if user is None or not verify_password(password, user.password_hash):
        return None
    return user


def issue_token_pair(db: Session, user: User) -> TokenPair:
    settings = get_settings()
    refresh_token = create_refresh_token()
    db_refresh_token = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(refresh_token),
        expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(db_refresh_token)
    db.commit()
    return TokenPair(access_token=create_access_token(user.id), refresh_token=refresh_token)


def get_active_refresh_token(db: Session, refresh_token: str) -> RefreshToken | None:
    token_hash = hash_refresh_token(refresh_token)
    db_token = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if db_token is None:
        return None
    now = datetime.now(UTC)
    expires_at = db_token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if db_token.revoked_at is not None or expires_at <= now:
        return None
    return db_token


def rotate_refresh_token(db: Session, refresh_token: str) -> TokenPair | None:
    token_hash = hash_refresh_token(refresh_token)
    db_token = db.scalar(
        select(RefreshToken)
        .where(RefreshToken.token_hash == token_hash)
        .with_for_update()
    )
    if db_token is None:
        return None
    now = datetime.now(UTC)
    expires_at = db_token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if db_token.revoked_at is not None or expires_at <= now:
        return None

    db_token.revoked_at = now
    user = db.get(User, db_token.user_id)
    if user is None:
        db.commit()
        return None

    settings = get_settings()
    new_refresh_token = create_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(new_refresh_token),
            expires_at=now + timedelta(days=settings.refresh_token_expire_days),
        )
    )
    db.commit()
    return TokenPair(access_token=create_access_token(user.id), refresh_token=new_refresh_token)


def purge_expired_refresh_tokens(db: Session) -> int:
    """Delete revoked or expired refresh tokens. Returns the count deleted."""
    from sqlalchemy import delete as sa_delete

    now = datetime.now(UTC)
    result = db.execute(
        sa_delete(RefreshToken).where(
            (RefreshToken.revoked_at.is_not(None)) | (RefreshToken.expires_at <= now)
        )
    )
    db.commit()
    return result.rowcount


def revoke_refresh_token(db: Session, refresh_token: str, user_id: uuid.UUID) -> bool:
    db_token = get_active_refresh_token(db, refresh_token)
    if db_token is None or db_token.user_id != user_id:
        return False
    db_token.revoked_at = datetime.now(UTC)
    db.commit()
    return True


def request_password_reset(db: Session, email: str) -> None:
    """Issue a single-use reset link for ``email`` if an account exists.

    Always returns ``None`` and never reveals whether the email is registered:
    when there's no matching user it simply does nothing. The raw token is
    emailed to the user; only its SHA-256 hash is stored.
    """
    user = get_user_by_email(db, email)
    if user is None:
        return

    settings = get_settings()
    raw_token = create_reset_token()
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=hash_reset_token(raw_token),
            expires_at=datetime.now(UTC)
            + timedelta(minutes=settings.password_reset_token_expire_minutes),
        )
    )
    db.commit()

    reset_url = f"{settings.frontend_url.rstrip('/')}/reset-password?token={raw_token}"
    send_password_reset_email(user.email, reset_url)


def reset_password(db: Session, token: str, new_password: str) -> bool:
    """Redeem a reset token and set the user's new password.

    Returns ``False`` if the token is unknown, expired, or already used.
    On success the token is marked used and all of the user's refresh tokens
    are revoked, ending any existing sessions.
    """
    token_hash = hash_reset_token(token)
    db_token = db.scalar(
        select(PasswordResetToken)
        .where(PasswordResetToken.token_hash == token_hash)
        .with_for_update()
    )
    if db_token is None:
        return False

    now = datetime.now(UTC)
    expires_at = db_token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if db_token.used_at is not None or expires_at <= now:
        return False

    user = db.get(User, db_token.user_id)
    if user is None:
        return False

    user.password_hash = hash_password(new_password)
    db_token.used_at = now
    # Invalidate every active session so a reset truly locks others out.
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    db.commit()
    return True
