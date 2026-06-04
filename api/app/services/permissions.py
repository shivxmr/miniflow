"""Pure permission helpers encoding the project-role matrix.

Per-project roles (``project_members.role``) are authoritative for every
project-scoped action. These functions hold no I/O so routers and the RBAC
dependencies can reuse them freely.

| Role   | Permissions                                                           |
| ------ | --------------------------------------------------------------------- |
| Admin  | Manage members, change roles, edit/delete any task, edit/delete proj. |
| Member | Create tasks, update/delete own (created or assigned) tasks, comment. |
| Viewer | Read-only.                                                            |
"""

import uuid

from app.models.enums import UserRole
from app.models.task import Task

WRITE_ROLES: frozenset[UserRole] = frozenset({UserRole.ADMIN, UserRole.MEMBER})


def can_create_task(role: UserRole) -> bool:
    """Admins and Members may create tasks; Viewers may not."""
    return role in WRITE_ROLES


def can_comment(role: UserRole) -> bool:
    """Admins and Members may comment on tasks; Viewers may not."""
    return role in WRITE_ROLES


def can_manage_labels(role: UserRole) -> bool:
    """Only Admins may create, rename, recolor, or delete project labels."""
    return role == UserRole.ADMIN


def can_apply_labels(role: UserRole) -> bool:
    """Admins and Members may apply/remove labels on any task; Viewers may not.

    Deliberately decoupled from :func:`can_modify_task`: applying a label is a
    lightweight categorization action, so a Member may label any task in the
    project, not only ones they created or are assigned to.
    """
    return role in WRITE_ROLES


def can_manage_members(role: UserRole) -> bool:
    """Only Admins may add/remove members or change their roles."""
    return role == UserRole.ADMIN


def can_manage_project(role: UserRole) -> bool:
    """Only Admins may edit or delete the project itself."""
    return role == UserRole.ADMIN


def can_modify_task(role: UserRole, user_id: uuid.UUID, task: Task) -> bool:
    """Whether ``user_id`` may update or delete ``task``.

    Admins may modify any task. Members may modify only tasks they created or
    are assigned to. Viewers may modify nothing.
    """
    if role == UserRole.ADMIN:
        return True
    if role == UserRole.MEMBER:
        return user_id in (task.created_by, task.assigned_to)
    return False


def can_delete_comment(role: UserRole, user_id: uuid.UUID, comment_user_id: uuid.UUID) -> bool:
    """Whether ``user_id`` may delete a comment authored by ``comment_user_id``.

    Admins may delete any comment. Members may delete only their own. Viewers
    are read-only and may delete nothing.
    """
    if role == UserRole.ADMIN:
        return True
    if role == UserRole.MEMBER:
        return user_id == comment_user_id
    return False
