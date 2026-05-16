import uuid
from types import SimpleNamespace

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token
from app.deps.rbac import get_project_membership, require_project_role
from app.models.enums import UserRole
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.task import Task
from app.models.user import User
from app.services.permissions import (
    can_comment,
    can_create_task,
    can_manage_members,
    can_manage_project,
    can_modify_task,
)


def _build_rbac_app() -> FastAPI:
    """Minimal app whose routes exercise the RBAC dependencies over HTTP."""
    app = FastAPI()

    @app.get("/projects/{project_id}/tasks")
    def list_tasks(
        membership: ProjectMember = Depends(get_project_membership),
    ) -> dict[str, str]:
        return {"role": membership.role.value}

    @app.post("/projects/{project_id}/tasks")
    def create_task(
        membership: ProjectMember = Depends(
            require_project_role(UserRole.ADMIN, UserRole.MEMBER)
        ),
    ) -> dict[str, str]:
        return {"role": membership.role.value}

    @app.post("/projects/{project_id}/members")
    def add_member(
        membership: ProjectMember = Depends(require_project_role(UserRole.ADMIN)),
    ) -> dict[str, str]:
        return {"role": membership.role.value}

    return app


@pytest.fixture
def rbac_client(db_session: Session):
    app = _build_rbac_app()

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _make_user(db: Session, email: str) -> User:
    user = User(name="Test User", email=email, password_hash="x")
    db.add(user)
    db.flush()
    return user


def _auth(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


@pytest.fixture
def project_setup(db_session: Session) -> SimpleNamespace:
    admin = _make_user(db_session, "admin@example.com")
    member = _make_user(db_session, "member@example.com")
    viewer = _make_user(db_session, "viewer@example.com")
    outsider = _make_user(db_session, "outsider@example.com")

    project = Project(name="Roadmap", created_by=admin.id)
    db_session.add(project)
    db_session.flush()

    db_session.add_all(
        [
            ProjectMember(project_id=project.id, user_id=admin.id, role=UserRole.ADMIN),
            ProjectMember(project_id=project.id, user_id=member.id, role=UserRole.MEMBER),
            ProjectMember(project_id=project.id, user_id=viewer.id, role=UserRole.VIEWER),
        ]
    )
    db_session.flush()

    return SimpleNamespace(
        project=project,
        admin=admin,
        member=member,
        viewer=viewer,
        outsider=outsider,
    )


# --- get_project_membership: who may reach a project at all ---


def test_member_can_read_project_resources(rbac_client, project_setup) -> None:
    response = rbac_client.get(
        f"/projects/{project_setup.project.id}/tasks",
        headers=_auth(project_setup.member),
    )
    assert response.status_code == 200
    assert response.json() == {"role": "member"}


def test_viewer_can_read_project_resources(rbac_client, project_setup) -> None:
    response = rbac_client.get(
        f"/projects/{project_setup.project.id}/tasks",
        headers=_auth(project_setup.viewer),
    )
    assert response.status_code == 200


def test_non_member_is_blocked_from_project(rbac_client, project_setup) -> None:
    response = rbac_client.get(
        f"/projects/{project_setup.project.id}/tasks",
        headers=_auth(project_setup.outsider),
    )
    assert response.status_code == 403


def test_missing_project_returns_404(rbac_client, project_setup) -> None:
    response = rbac_client.get(
        f"/projects/{uuid.uuid4()}/tasks",
        headers=_auth(project_setup.admin),
    )
    assert response.status_code == 404


def test_unauthenticated_request_is_rejected(rbac_client, project_setup) -> None:
    response = rbac_client.get(f"/projects/{project_setup.project.id}/tasks")
    assert response.status_code == 401


# --- require_project_role: write actions gated by project role ---


def test_admin_can_create_task(rbac_client, project_setup) -> None:
    response = rbac_client.post(
        f"/projects/{project_setup.project.id}/tasks",
        headers=_auth(project_setup.admin),
    )
    assert response.status_code == 200


def test_member_can_create_task(rbac_client, project_setup) -> None:
    response = rbac_client.post(
        f"/projects/{project_setup.project.id}/tasks",
        headers=_auth(project_setup.member),
    )
    assert response.status_code == 200


def test_viewer_cannot_create_task(rbac_client, project_setup) -> None:
    response = rbac_client.post(
        f"/projects/{project_setup.project.id}/tasks",
        headers=_auth(project_setup.viewer),
    )
    assert response.status_code == 403


def test_non_member_cannot_create_task(rbac_client, project_setup) -> None:
    response = rbac_client.post(
        f"/projects/{project_setup.project.id}/tasks",
        headers=_auth(project_setup.outsider),
    )
    assert response.status_code == 403


def test_admin_can_manage_members(rbac_client, project_setup) -> None:
    response = rbac_client.post(
        f"/projects/{project_setup.project.id}/members",
        headers=_auth(project_setup.admin),
    )
    assert response.status_code == 200


def test_member_cannot_manage_members(rbac_client, project_setup) -> None:
    response = rbac_client.post(
        f"/projects/{project_setup.project.id}/members",
        headers=_auth(project_setup.member),
    )
    assert response.status_code == 403


def test_viewer_cannot_manage_members(rbac_client, project_setup) -> None:
    response = rbac_client.post(
        f"/projects/{project_setup.project.id}/members",
        headers=_auth(project_setup.viewer),
    )
    assert response.status_code == 403


# --- permission matrix helpers ---


@pytest.mark.parametrize(
    "role,expected",
    [(UserRole.ADMIN, True), (UserRole.MEMBER, True), (UserRole.VIEWER, False)],
)
def test_can_create_task_matrix(role: UserRole, expected: bool) -> None:
    assert can_create_task(role) is expected


@pytest.mark.parametrize(
    "role,expected",
    [(UserRole.ADMIN, True), (UserRole.MEMBER, True), (UserRole.VIEWER, False)],
)
def test_can_comment_matrix(role: UserRole, expected: bool) -> None:
    assert can_comment(role) is expected


@pytest.mark.parametrize(
    "role,expected",
    [(UserRole.ADMIN, True), (UserRole.MEMBER, False), (UserRole.VIEWER, False)],
)
def test_can_manage_members_matrix(role: UserRole, expected: bool) -> None:
    assert can_manage_members(role) is expected


@pytest.mark.parametrize(
    "role,expected",
    [(UserRole.ADMIN, True), (UserRole.MEMBER, False), (UserRole.VIEWER, False)],
)
def test_can_manage_project_matrix(role: UserRole, expected: bool) -> None:
    assert can_manage_project(role) is expected


# --- object-level task checks ---


def test_admin_can_modify_any_task() -> None:
    task = Task(title="t", project_id=uuid.uuid4(), created_by=uuid.uuid4())
    assert can_modify_task(UserRole.ADMIN, uuid.uuid4(), task) is True


def test_member_can_modify_task_they_created() -> None:
    user_id = uuid.uuid4()
    task = Task(title="t", project_id=uuid.uuid4(), created_by=user_id)
    assert can_modify_task(UserRole.MEMBER, user_id, task) is True


def test_member_can_modify_task_assigned_to_them() -> None:
    user_id = uuid.uuid4()
    task = Task(
        title="t",
        project_id=uuid.uuid4(),
        created_by=uuid.uuid4(),
        assigned_to=user_id,
    )
    assert can_modify_task(UserRole.MEMBER, user_id, task) is True


def test_member_cannot_modify_someone_elses_task() -> None:
    task = Task(
        title="t",
        project_id=uuid.uuid4(),
        created_by=uuid.uuid4(),
        assigned_to=uuid.uuid4(),
    )
    assert can_modify_task(UserRole.MEMBER, uuid.uuid4(), task) is False


def test_viewer_cannot_modify_any_task() -> None:
    user_id = uuid.uuid4()
    task = Task(title="t", project_id=uuid.uuid4(), created_by=user_id)
    assert can_modify_task(UserRole.VIEWER, user_id, task) is False
