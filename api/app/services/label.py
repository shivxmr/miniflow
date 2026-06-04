"""Business logic for project labels and their application to tasks.

Authorization (project role) is enforced by the routers via the RBAC
dependencies and permission helpers; this layer handles persistence, query
building, and the integrity rules (uniqueness, the per-task cap, and that a
label belongs to its task's project).
"""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.label import MAX_LABELS_PER_TASK, Label
from app.models.task import Task
from app.schemas.label import LabelCreate, LabelUpdate


def list_labels(db: Session, project_id: uuid.UUID) -> list[Label]:
    return list(
        db.scalars(select(Label).where(Label.project_id == project_id).order_by(Label.name))
    )


def get_label(db: Session, project_id: uuid.UUID, label_id: uuid.UUID) -> Label | None:
    return db.scalar(select(Label).where(Label.id == label_id, Label.project_id == project_id))


def _name_taken(
    db: Session,
    project_id: uuid.UUID,
    name: str,
    *,
    exclude_id: uuid.UUID | None = None,
) -> bool:
    query = select(Label.id).where(Label.project_id == project_id, Label.name == name)
    if exclude_id is not None:
        query = query.where(Label.id != exclude_id)
    return db.scalar(query) is not None


def create_label(db: Session, project_id: uuid.UUID, payload: LabelCreate) -> Label:
    name = payload.name.strip()
    if _name_taken(db, project_id, name):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A label with that name already exists in this project",
        )
    label = Label(project_id=project_id, name=name, color=payload.color)
    db.add(label)
    db.commit()
    db.refresh(label)
    return label


def update_label(db: Session, label: Label, payload: LabelUpdate) -> Label:
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        name = data["name"].strip()
        if _name_taken(db, label.project_id, name, exclude_id=label.id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A label with that name already exists in this project",
            )
        label.name = name
    if "color" in data and data["color"] is not None:
        label.color = data["color"]
    db.commit()
    db.refresh(label)
    return label


def delete_label(db: Session, label: Label) -> None:
    db.delete(label)
    db.commit()


def _load_task_with_labels(db: Session, task_id: uuid.UUID) -> Task:
    task = db.scalar(select(Task).where(Task.id == task_id).options(selectinload(Task.labels)))
    assert task is not None  # the caller has already resolved the task
    return task


def apply_label(db: Session, task: Task, label: Label) -> Task:
    """Attach ``label`` to ``task``. Idempotent; enforces the per-task cap.

    Raises 400 if the label belongs to a different project, or 409 if the task
    already carries the maximum number of labels.
    """
    if label.project_id != task.project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The label belongs to a different project",
        )
    if any(existing.id == label.id for existing in task.labels):
        return _load_task_with_labels(db, task.id)
    if len(task.labels) >= MAX_LABELS_PER_TASK:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A task may have at most {MAX_LABELS_PER_TASK} labels",
        )
    task.labels.append(label)
    db.commit()
    return _load_task_with_labels(db, task.id)


def remove_label(db: Session, task: Task, label: Label) -> Task:
    """Detach ``label`` from ``task``. Idempotent if it was not applied."""
    task.labels = [existing for existing in task.labels if existing.id != label.id]
    db.commit()
    return _load_task_with_labels(db, task.id)
