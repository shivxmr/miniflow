import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps.auth import get_current_user
from app.deps.rbac import get_project_membership, require_project_role
from app.models.enums import TaskPriority, TaskStatus, UserRole
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.user import User
from app.schemas.project import (
    MemberAdd,
    MemberRoleUpdate,
    ProjectCreate,
    ProjectMemberRead,
    ProjectRead,
    ProjectUpdate,
)
from app.schemas.task import TaskListResponse, TaskRead
from app.services import project as project_service
from app.services import task as task_service
from app.services.auth import get_user_by_email

router = APIRouter(prefix="/projects", tags=["projects"])


def _to_read(project: Project, role: UserRole) -> ProjectRead:
    return ProjectRead(
        id=project.id,
        name=project.name,
        description=project.description,
        created_by=project.created_by,
        created_at=project.created_at,
        role=role,
    )


@router.get("", response_model=list[ProjectRead])
def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProjectRead]:
    return [
        _to_read(project, role)
        for project, role in project_service.list_projects_for_user(db, current_user.id)
    ]


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectRead:
    project = project_service.create_project(db, payload, current_user.id)
    return _to_read(project, UserRole.ADMIN)


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(
    project_id: uuid.UUID,
    membership: ProjectMember = Depends(get_project_membership),
    db: Session = Depends(get_db),
) -> ProjectRead:
    project = db.get(Project, project_id)
    return _to_read(project, membership.role)


@router.put("/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdate,
    membership: ProjectMember = Depends(require_project_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> ProjectRead:
    project = db.get(Project, project_id)
    project = project_service.update_project(db, project, payload)
    return _to_read(project, membership.role)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: uuid.UUID,
    membership: ProjectMember = Depends(require_project_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> Response:
    project = db.get(Project, project_id)
    project_service.delete_project(db, project)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{project_id}/tasks", response_model=TaskListResponse)
def list_project_tasks(
    project_id: uuid.UUID,
    status: TaskStatus | None = None,
    priority: TaskPriority | None = None,
    assigned_to: uuid.UUID | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    membership: ProjectMember = Depends(get_project_membership),
    db: Session = Depends(get_db),
) -> TaskListResponse:
    items, total = task_service.list_tasks(
        db,
        project_id,
        status=status,
        priority=priority,
        assigned_to=assigned_to,
        limit=limit,
        offset=offset,
    )
    return TaskListResponse(
        items=[TaskRead.model_validate(task) for task in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{project_id}/members", response_model=list[ProjectMemberRead])
def list_members(
    project_id: uuid.UUID,
    membership: ProjectMember = Depends(get_project_membership),
    db: Session = Depends(get_db),
) -> list[ProjectMember]:
    return project_service.list_members(db, project_id)


@router.post(
    "/{project_id}/members",
    response_model=ProjectMemberRead,
    status_code=status.HTTP_201_CREATED,
)
def add_member(
    project_id: uuid.UUID,
    payload: MemberAdd,
    membership: ProjectMember = Depends(require_project_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> ProjectMember:
    user = get_user_by_email(db, payload.email)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No user is registered with that email",
        )
    if project_service.get_membership(db, project_id, user.id) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this project",
        )
    return project_service.add_member(db, project_id, user.id, payload.role)


@router.put("/{project_id}/members/{user_id}", response_model=ProjectMemberRead)
def update_member(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: MemberRoleUpdate,
    membership: ProjectMember = Depends(require_project_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> ProjectMember:
    target = project_service.get_membership(db, project_id, user_id)
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="That user is not a member of this project",
        )
    if (
        target.role == UserRole.ADMIN
        and payload.role != UserRole.ADMIN
        and project_service.count_admins(db, project_id) == 1
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A project must keep at least one admin",
        )
    return project_service.update_member_role(db, target, payload.role)


@router.delete(
    "/{project_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_member(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    membership: ProjectMember = Depends(require_project_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> Response:
    target = project_service.get_membership(db, project_id, user_id)
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="That user is not a member of this project",
        )
    if target.role == UserRole.ADMIN and project_service.count_admins(db, project_id) == 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A project must keep at least one admin",
        )
    project_service.remove_member(db, target)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
