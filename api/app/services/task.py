"""Business logic for tasks: listing with filters, and CRUD.

Authorization (project role, object-level ownership) is enforced by the
routers via the RBAC dependencies and permission helpers; this layer only
handles persistence and query building.
"""

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.enums import TaskPriority, TaskStatus
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskUpdate


def list_tasks(
    db: Session,
    project_id: uuid.UUID,
    *,
    status: TaskStatus | None = None,
    priority: TaskPriority | None = None,
    assigned_to: uuid.UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Task], int]:
    """Return a page of a project's tasks plus the total matching count."""
    conditions = [Task.project_id == project_id]
    if status is not None:
        conditions.append(Task.status == status)
    if priority is not None:
        conditions.append(Task.priority == priority)
    if assigned_to is not None:
        conditions.append(Task.assigned_to == assigned_to)

    total = db.scalar(select(func.count()).select_from(Task).where(*conditions)) or 0
    items = list(
        db.scalars(
            select(Task)
            .where(*conditions)
            .order_by(Task.created_at, Task.id)
            .limit(limit)
            .offset(offset)
        )
    )
    return items, total


def create_task(db: Session, payload: TaskCreate, creator_id: uuid.UUID) -> Task:
    task = Task(
        project_id=payload.project_id,
        title=payload.title.strip(),
        description=payload.description,
        assigned_to=payload.assigned_to,
        status=payload.status,
        priority=payload.priority,
        due_date=payload.due_date,
        created_by=creator_id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def update_task(db: Session, task: Task, payload: TaskUpdate) -> Task:
    data = payload.model_dump(exclude_unset=True)
    if data.get("title") is not None:
        task.title = data["title"].strip()
    for field in ("description", "assigned_to", "status", "priority", "due_date"):
        if field in data:
            setattr(task, field, data[field])
    db.commit()
    db.refresh(task)
    return task


def delete_task(db: Session, task: Task) -> None:
    db.delete(task)
    db.commit()
