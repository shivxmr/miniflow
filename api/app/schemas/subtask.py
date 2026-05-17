import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SubtaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=220)


class SubtaskUpdate(BaseModel):
    """Partial update; toggle ``is_done`` and/or rename the subtask."""

    title: str | None = Field(default=None, min_length=1, max_length=220)
    is_done: bool | None = None


class SubtaskRead(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    title: str
    is_done: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SubtaskGenerateResponse(BaseModel):
    """AI-suggested subtask titles, returned for the user to review and save."""

    suggestions: list[str]
