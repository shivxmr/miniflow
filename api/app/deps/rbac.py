"""FastAPI dependencies that enforce project-scoped role-based access control.

These resolve the caller's ``project_members.role`` for a project named by the
``project_id`` path parameter and reject the request server-side. Routers stay
declarative: they just declare which roles a route requires.
"""

import uuid
from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps.auth import get_current_user
from app.models.enums import UserRole
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.user import User


def get_project_membership(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectMember:
    """Return the caller's membership of ``project_id``.

    Raises 404 if the project does not exist, or 403 if the caller is not a
    member. Any project member (including Viewers) passes this gate.
    """
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    membership = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == current_user.id,
        )
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this project",
        )
    return membership


def require_project_role(*allowed_roles: UserRole) -> Callable[..., ProjectMember]:
    """Build a dependency that admits only the given project roles.

    Usage in a router: ``Depends(require_project_role(UserRole.ADMIN))``.
    """

    def dependency(
        membership: ProjectMember = Depends(get_project_membership),
    ) -> ProjectMember:
        if membership.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your project role does not permit this action",
            )
        return membership

    return dependency
