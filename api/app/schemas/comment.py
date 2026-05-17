import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class CommentAuthor(BaseModel):
    """The subset of a user shown alongside their comment."""

    id: uuid.UUID
    name: str

    model_config = ConfigDict(from_attributes=True)


class CommentRead(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    body: str
    created_at: datetime
    author: CommentAuthor

    model_config = ConfigDict(from_attributes=True)
