import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
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
    db_token = get_active_refresh_token(db, refresh_token)
    if db_token is None:
        return None

    db_token.revoked_at = datetime.now(UTC)
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
            expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days),
        )
    )
    db.commit()
    return TokenPair(access_token=create_access_token(user.id), refresh_token=new_refresh_token)


def revoke_refresh_token(db: Session, refresh_token: str, user_id: uuid.UUID) -> bool:
    db_token = get_active_refresh_token(db, refresh_token)
    if db_token is None or db_token.user_id != user_id:
        return False
    db_token.revoked_at = datetime.now(UTC)
    db.commit()
    return True
