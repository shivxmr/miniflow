import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps.auth import get_current_user
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.task import Task
from app.models.user import User
from app.schemas.task import TaskCreate, TaskRead, TaskUpdate
from app.services import project as project_service
from app.services import task as task_service
from app.services.permissions import can_create_task, can_modify_task

router = APIRouter(prefix="/tasks", tags=["tasks"])


def load_task_with_membership(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> tuple[Task, ProjectMember]:
    """Resolve a task and the caller's membership of its project.

    404 if the task does not exist; 403 if the caller is not a member of the
    task's project.
    """
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    membership = project_service.get_membership(db, task.project_id, current_user.id)
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this project",
        )
    return task, membership


def _ensure_assignee_is_member(
    db: Session, project_id: uuid.UUID, assignee_id: uuid.UUID
) -> None:
    if project_service.get_membership(db, project_id, assignee_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The assignee must be a member of the project",
        )


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Task:
    if db.get(Project, payload.project_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    membership = project_service.get_membership(db, payload.project_id, current_user.id)
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this project",
        )
    if not can_create_task(membership.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your project role does not permit creating tasks",
        )
    if payload.assigned_to is not None:
        _ensure_assignee_is_member(db, payload.project_id, payload.assigned_to)
    return task_service.create_task(db, payload, current_user.id)


@router.get("/{task_id}", response_model=TaskRead)
def get_task(
    loaded: tuple[Task, ProjectMember] = Depends(load_task_with_membership),
) -> Task:
    task, _membership = loaded
    return task


@router.put("/{task_id}", response_model=TaskRead)
def update_task(
    payload: TaskUpdate,
    current_user: User = Depends(get_current_user),
    loaded: tuple[Task, ProjectMember] = Depends(load_task_with_membership),
    db: Session = Depends(get_db),
) -> Task:
    task, membership = loaded
    if not can_modify_task(membership.role, current_user.id, task):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You may only modify tasks you created or are assigned to",
        )
    if payload.assigned_to is not None:
        _ensure_assignee_is_member(db, task.project_id, payload.assigned_to)
    return task_service.update_task(db, task, payload)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    current_user: User = Depends(get_current_user),
    loaded: tuple[Task, ProjectMember] = Depends(load_task_with_membership),
    db: Session = Depends(get_db),
) -> Response:
    task, membership = loaded
    if not can_modify_task(membership.role, current_user.id, task):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You may only modify tasks you created or are assigned to",
        )
    task_service.delete_task(db, task)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
