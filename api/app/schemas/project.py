import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import UserRole
from app.schemas.auth import UserRead


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)


class ProjectUpdate(BaseModel):
    """Partial update; only fields the client sends are applied."""

    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)


class ProjectRead(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    created_by: uuid.UUID
    created_at: datetime
    role: UserRole  # the calling user's role within this project


class MemberAdd(BaseModel):
    email: EmailStr
    role: UserRole = UserRole.MEMBER


class MemberRoleUpdate(BaseModel):
    role: UserRole


class ProjectMemberRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    role: UserRole
    user: UserRead

    model_config = {"from_attributes": True}


class ProjectSummaryResponse(BaseModel):
    """An AI-generated plain-text progress summary of a project."""

    summary: str
