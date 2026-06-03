from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.limiter import limiter
from app.deps.auth import get_current_user
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LogoutRequest,
    MessageResponse,
    RefreshRequest,
    ResetPasswordRequest,
    TokenPair,
    UserCreate,
    UserLogin,
    UserRead,
)
from app.services.auth import (
    authenticate_user,
    create_user,
    get_user_by_email,
    issue_token_pair,
    request_password_reset,
    reset_password,
    revoke_refresh_token,
    rotate_refresh_token,
)

# Identical response whether or not the email is registered, to avoid
# revealing which addresses have accounts.
_FORGOT_PASSWORD_MESSAGE = "If an account exists for that email, a reset link has been sent."

router = APIRouter(tags=["auth"])
settings = get_settings()


@router.post("/signup", response_model=UserRead, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.auth_rate_limit)
def signup(request: Request, payload: UserCreate, db: Session = Depends(get_db)) -> User:
    if get_user_by_email(db, payload.email) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered",
        )
    return create_user(db, payload)


@router.post("/login", response_model=TokenPair)
@limiter.limit(settings.auth_rate_limit)
def login(request: Request, payload: UserLogin, db: Session = Depends(get_db)) -> TokenPair:
    user = authenticate_user(db, payload.email, payload.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return issue_token_pair(db, user)


@router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenPair:
    token_pair = rotate_refresh_token(db, payload.refresh_token)
    if token_pair is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    return token_pair


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    payload: LogoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    revoke_refresh_token(db, payload.refresh_token, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/auth/forgot-password", response_model=MessageResponse)
@limiter.limit(settings.auth_rate_limit)
def forgot_password(
    request: Request,
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db),
) -> MessageResponse:
    request_password_reset(db, payload.email)
    return MessageResponse(message=_FORGOT_PASSWORD_MESSAGE)


@router.post("/auth/reset-password", response_model=MessageResponse)
def reset_password_endpoint(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
) -> MessageResponse:
    if not reset_password(db, payload.token, payload.new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset link is invalid or has expired. Request a new one.",
        )
    return MessageResponse(message="Password updated.")


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
