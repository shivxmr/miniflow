"""Business logic for projects and project membership.

Routers stay thin; all project/membership reads and writes go through here.
"""

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.enums import UserRole
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.schemas.project import ProjectCreate, ProjectUpdate


def get_membership(
    db: Session, project_id: uuid.UUID, user_id: uuid.UUID
) -> ProjectMember | None:
    """Return ``user_id``'s membership of ``project_id``, or None."""
    return db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )


def list_projects_for_user(
    db: Session, user_id: uuid.UUID
) -> list[tuple[Project, UserRole]]:
    """Return every project the user belongs to, paired with their role."""
    rows = db.execute(
        select(Project, ProjectMember.role)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .where(ProjectMember.user_id == user_id)
        .order_by(Project.created_at)
    ).all()
    return [(project, role) for project, role in rows]


def create_project(
    db: Session, payload: ProjectCreate, creator_id: uuid.UUID
) -> Project:
    """Create a project and enroll its creator as an Admin member."""
    project = Project(
        name=payload.name.strip(),
        description=payload.description,
        created_by=creator_id,
    )
    db.add(project)
    db.flush()
    db.add(
        ProjectMember(
            project_id=project.id,
            user_id=creator_id,
            role=UserRole.ADMIN,
        )
    )
    db.commit()
    db.refresh(project)
    return project


def update_project(db: Session, project: Project, payload: ProjectUpdate) -> Project:
    data = payload.model_dump(exclude_unset=True)
    if data.get("name") is not None:
        project.name = data["name"].strip()
    if "description" in data:
        project.description = data["description"]
    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, project: Project) -> None:
    db.delete(project)
    db.commit()


def list_members(
    db: Session,
    project_id: uuid.UUID,
    *,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[ProjectMember], int]:
    total = (
        db.scalar(
            select(func.count())
            .select_from(ProjectMember)
            .where(ProjectMember.project_id == project_id)
        )
        or 0
    )
    items = list(
        db.scalars(
            select(ProjectMember)
            .options(selectinload(ProjectMember.user))
            .where(ProjectMember.project_id == project_id)
            .order_by(ProjectMember.role)
            .limit(limit)
            .offset(offset)
        )
    )
    return items, total


def count_admins(db: Session, project_id: uuid.UUID) -> int:
    """Number of Admin members on a project — used to protect the last admin."""
    return (
        db.scalar(
            select(func.count())
            .select_from(ProjectMember)
            .where(
                ProjectMember.project_id == project_id,
                ProjectMember.role == UserRole.ADMIN,
            )
        )
        or 0
    )


def add_member(
    db: Session, project_id: uuid.UUID, user_id: uuid.UUID, role: UserRole
) -> ProjectMember:
    member = ProjectMember(project_id=project_id, user_id=user_id, role=role)
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


def update_member_role(
    db: Session, membership: ProjectMember, role: UserRole
) -> ProjectMember:
    membership.role = role
    db.commit()
    db.refresh(membership)
    return membership


def remove_member(db: Session, membership: ProjectMember) -> None:
    db.delete(membership)
    db.commit()
