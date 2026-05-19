import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.ai_errors import ai_errors
from app.core.database import get_db
from app.deps.auth import get_current_user
from app.models.comment import Comment
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.subtask import Subtask
from app.models.task import Task
from app.models.user import User
from app.schemas.comment import CommentCreate, CommentRead
from app.schemas.subtask import (
    SubtaskCreate,
    SubtaskGenerateResponse,
    SubtaskRead,
    SubtaskUpdate,
)
from app.schemas.task import TaskCreate, TaskRead, TaskUpdate
from app.services import ai
from app.services import comment as comment_service
from app.services import project as project_service
from app.services import subtask as subtask_service
from app.services import task as task_service
from app.services.permissions import (
    can_comment,
    can_create_task,
    can_delete_comment,
    can_modify_task,
)

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


# --- Subtasks ---------------------------------------------------------------


def load_subtask(
    subtask_id: uuid.UUID,
    loaded: tuple[Task, ProjectMember] = Depends(load_task_with_membership),
    db: Session = Depends(get_db),
) -> tuple[Subtask, Task, ProjectMember]:
    """Resolve a subtask, its parent task, and the caller's membership.

    404 if the subtask does not exist or does not belong to the task in the
    path; the task/membership checks are inherited from
    :func:`load_task_with_membership`.
    """
    task, membership = loaded
    subtask = subtask_service.get_subtask(db, task.id, subtask_id)
    if subtask is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subtask not found",
        )
    return subtask, task, membership


@router.get("/{task_id}/subtasks", response_model=list[SubtaskRead])
def list_subtasks(
    loaded: tuple[Task, ProjectMember] = Depends(load_task_with_membership),
    db: Session = Depends(get_db),
) -> list[Subtask]:
    task, _membership = loaded
    return subtask_service.list_subtasks(db, task.id)


@router.post(
    "/{task_id}/subtasks/generate",
    response_model=SubtaskGenerateResponse,
)
async def generate_subtasks(
    current_user: User = Depends(get_current_user),
    loaded: tuple[Task, ProjectMember] = Depends(load_task_with_membership),
) -> SubtaskGenerateResponse:
    """Ask the AI to suggest subtasks for the task; the caller saves them."""
    task, membership = loaded
    if not can_create_task(membership.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your project role does not permit generating subtasks",
        )
    with ai_errors():
        suggestions = await ai.generate_subtask_titles(task.title, task.description)
    return SubtaskGenerateResponse(suggestions=suggestions)


@router.post(
    "/{task_id}/subtasks",
    response_model=SubtaskRead,
    status_code=status.HTTP_201_CREATED,
)
def create_subtask(
    payload: SubtaskCreate,
    current_user: User = Depends(get_current_user),
    loaded: tuple[Task, ProjectMember] = Depends(load_task_with_membership),
    db: Session = Depends(get_db),
) -> Subtask:
    task, membership = loaded
    if not can_create_task(membership.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your project role does not permit adding subtasks",
        )
    return subtask_service.create_subtask(db, task.id, payload.title)


@router.patch("/{task_id}/subtasks/{subtask_id}", response_model=SubtaskRead)
def update_subtask(
    payload: SubtaskUpdate,
    current_user: User = Depends(get_current_user),
    loaded: tuple[Subtask, Task, ProjectMember] = Depends(load_subtask),
    db: Session = Depends(get_db),
) -> Subtask:
    subtask, task, membership = loaded
    if not can_modify_task(membership.role, current_user.id, task):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You may only modify subtasks of tasks you can edit",
        )
    return subtask_service.update_subtask(db, subtask, payload)


@router.delete(
    "/{task_id}/subtasks/{subtask_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_subtask(
    current_user: User = Depends(get_current_user),
    loaded: tuple[Subtask, Task, ProjectMember] = Depends(load_subtask),
    db: Session = Depends(get_db),
) -> Response:
    subtask, task, membership = loaded
    if not can_modify_task(membership.role, current_user.id, task):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You may only modify subtasks of tasks you can edit",
        )
    subtask_service.delete_subtask(db, subtask)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Comments ---------------------------------------------------------------


@router.get("/{task_id}/comments", response_model=list[CommentRead])
def list_comments(
    loaded: tuple[Task, ProjectMember] = Depends(load_task_with_membership),
    db: Session = Depends(get_db),
) -> list[Comment]:
    """List a task's comments. Any project member, including Viewers, may read."""
    task, _membership = loaded
    return comment_service.list_comments(db, task.id)


@router.post(
    "/{task_id}/comments",
    response_model=CommentRead,
    status_code=status.HTTP_201_CREATED,
)
def create_comment(
    payload: CommentCreate,
    current_user: User = Depends(get_current_user),
    loaded: tuple[Task, ProjectMember] = Depends(load_task_with_membership),
    db: Session = Depends(get_db),
) -> Comment:
    task, membership = loaded
    if not can_comment(membership.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your project role does not permit commenting",
        )
    return comment_service.create_comment(db, task.id, current_user.id, payload.body)


@router.delete(
    "/{task_id}/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_comment(
    comment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    loaded: tuple[Task, ProjectMember] = Depends(load_task_with_membership),
    db: Session = Depends(get_db),
) -> Response:
    task, membership = loaded
    comment = comment_service.get_comment(db, task.id, comment_id)
    if comment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )
    if not can_delete_comment(membership.role, current_user.id, comment.user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You may only delete your own comments",
        )
    comment_service.delete_comment(db, comment)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
