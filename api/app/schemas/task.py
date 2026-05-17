import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import TaskPriority, TaskStatus


class TaskCreate(BaseModel):
    project_id: uuid.UUID
    title: str = Field(min_length=1, max_length=220)
    description: str | None = Field(default=None, max_length=4000)
    assigned_to: uuid.UUID | None = None
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: date | None = None


class TaskUpdate(BaseModel):
    """Partial update; only fields the client sends are applied."""

    title: str | None = Field(default=None, min_length=1, max_length=220)
    description: str | None = Field(default=None, max_length=4000)
    assigned_to: uuid.UUID | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    due_date: date | None = None


class TaskRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    description: str | None
    assigned_to: uuid.UUID | None
    status: TaskStatus
    priority: TaskPriority
    due_date: date | None
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TaskListResponse(BaseModel):
    items: list[TaskRead]
    total: int
    limit: int
    offset: int


class GenerateTasksRequest(BaseModel):
    """Free text to be turned into draft tasks by the AI."""

    text: str = Field(min_length=1, max_length=4000)


class TaskDraft(BaseModel):
    """An AI-suggested task the user reviews and edits before creating it."""

    title: str
    description: str
    priority: TaskPriority


class TaskDraftsResponse(BaseModel):
    """AI-suggested draft tasks, returned for the user to review and create."""

    drafts: list[TaskDraft]
