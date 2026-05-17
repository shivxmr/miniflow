"""Business logic for subtasks: listing and CRUD.

Authorization (project membership, the parent task's modify rules) is enforced
by the router; this layer only handles persistence.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.subtask import Subtask
from app.schemas.subtask import SubtaskUpdate


def list_subtasks(db: Session, task_id: uuid.UUID) -> list[Subtask]:
    """Return a task's subtasks, oldest first."""
    return list(
        db.scalars(
            select(Subtask)
            .where(Subtask.task_id == task_id)
            .order_by(Subtask.created_at, Subtask.id)
        )
    )


def get_subtask(db: Session, task_id: uuid.UUID, subtask_id: uuid.UUID) -> Subtask | None:
    """Return a subtask only if it belongs to ``task_id``."""
    subtask = db.get(Subtask, subtask_id)
    if subtask is None or subtask.task_id != task_id:
        return None
    return subtask


def create_subtask(db: Session, task_id: uuid.UUID, title: str) -> Subtask:
    subtask = Subtask(task_id=task_id, title=title.strip())
    db.add(subtask)
    db.commit()
    db.refresh(subtask)
    return subtask


def update_subtask(db: Session, subtask: Subtask, payload: SubtaskUpdate) -> Subtask:
    data = payload.model_dump(exclude_unset=True)
    if data.get("title") is not None:
        subtask.title = data["title"].strip()
    if "is_done" in data and data["is_done"] is not None:
        subtask.is_done = data["is_done"]
    db.commit()
    db.refresh(subtask)
    return subtask


def delete_subtask(db: Session, subtask: Subtask) -> None:
    db.delete(subtask)
    db.commit()
