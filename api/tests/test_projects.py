import uuid
from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import UserRole
from app.models.project_member import ProjectMember

PASSWORD = "correct-horse-battery"


def register(client: TestClient, email: str, name: str = "Test User") -> SimpleNamespace:
    """Sign up + log in a user; return their id and auth headers."""
    created = client.post(
        "/signup",
        json={"name": name, "email": email, "password": PASSWORD},
    )
    assert created.status_code == 201
    tokens = client.post("/login", json={"email": email, "password": PASSWORD})
    assert tokens.status_code == 200
    access_token = tokens.json()["access_token"]
    return SimpleNamespace(
        id=uuid.UUID(created.json()["id"]),
        email=email,
        headers={"Authorization": f"Bearer {access_token}"},
    )


def add_membership(
    db: Session, project_id: uuid.UUID, user_id: uuid.UUID, role: UserRole
) -> None:
    db.add(ProjectMember(project_id=project_id, user_id=user_id, role=role))
    db.commit()


def create_project(client: TestClient, headers: dict[str, str], name: str = "Roadmap") -> dict:
    response = client.post("/projects", json={"name": name}, headers=headers)
    assert response.status_code == 201
    return response.json()


# --- POST /projects ---


def test_create_project_returns_creator_as_admin(client: TestClient) -> None:
    owner = register(client, "owner@example.com")

    response = client.post(
        "/projects",
        json={"name": "Roadmap", "description": "Q3 plan"},
        headers=owner.headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Roadmap"
    assert body["description"] == "Q3 plan"
    assert body["created_by"] == str(owner.id)
    assert body["role"] == "admin"


def test_create_project_persists_admin_membership(
    client: TestClient, db_session: Session
) -> None:
    owner = register(client, "owner@example.com")

    project = create_project(client, owner.headers)

    membership = db_session.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == uuid.UUID(project["id"]),
            ProjectMember.user_id == owner.id,
        )
    )
    assert membership is not None
    assert membership.role == UserRole.ADMIN


def test_create_project_requires_authentication(client: TestClient) -> None:
    response = client.post("/projects", json={"name": "Roadmap"})
    assert response.status_code == 401


def test_create_project_rejects_blank_name(client: TestClient) -> None:
    owner = register(client, "owner@example.com")
    response = client.post("/projects", json={"name": ""}, headers=owner.headers)
    assert response.status_code == 422


# --- GET /projects ---


def test_list_projects_returns_only_callers_projects(client: TestClient) -> None:
    alice = register(client, "alice@example.com")
    bob = register(client, "bob@example.com")
    create_project(client, alice.headers, name="Alice Project")
    create_project(client, bob.headers, name="Bob Project")

    response = client.get("/projects", headers=alice.headers)

    assert response.status_code == 200
    assert [p["name"] for p in response.json()] == ["Alice Project"]


def test_list_projects_requires_authentication(client: TestClient) -> None:
    response = client.get("/projects")
    assert response.status_code == 401


# --- GET /projects/:id ---


def test_get_project_as_member(client: TestClient) -> None:
    owner = register(client, "owner@example.com")
    project = create_project(client, owner.headers)

    response = client.get(f"/projects/{project['id']}", headers=owner.headers)

    assert response.status_code == 200
    assert response.json()["id"] == project["id"]


def test_get_project_blocks_non_member(client: TestClient) -> None:
    owner = register(client, "owner@example.com")
    outsider = register(client, "outsider@example.com")
    project = create_project(client, owner.headers)

    response = client.get(f"/projects/{project['id']}", headers=outsider.headers)

    assert response.status_code == 403


def test_get_missing_project_returns_404(client: TestClient) -> None:
    owner = register(client, "owner@example.com")
    response = client.get(f"/projects/{uuid.uuid4()}", headers=owner.headers)
    assert response.status_code == 404


# --- PUT /projects/:id ---


def test_update_project_as_admin(client: TestClient) -> None:
    owner = register(client, "owner@example.com")
    project = create_project(client, owner.headers)

    response = client.put(
        f"/projects/{project['id']}",
        json={"name": "Roadmap v2", "description": "updated"},
        headers=owner.headers,
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Roadmap v2"
    assert response.json()["description"] == "updated"


def test_update_project_blocks_member(client: TestClient, db_session: Session) -> None:
    owner = register(client, "owner@example.com")
    member = register(client, "member@example.com")
    project = create_project(client, owner.headers)
    add_membership(db_session, uuid.UUID(project["id"]), member.id, UserRole.MEMBER)

    response = client.put(
        f"/projects/{project['id']}",
        json={"name": "Nope"},
        headers=member.headers,
    )

    assert response.status_code == 403


def test_update_project_blocks_viewer(client: TestClient, db_session: Session) -> None:
    owner = register(client, "owner@example.com")
    viewer = register(client, "viewer@example.com")
    project = create_project(client, owner.headers)
    add_membership(db_session, uuid.UUID(project["id"]), viewer.id, UserRole.VIEWER)

    response = client.put(
        f"/projects/{project['id']}",
        json={"name": "Nope"},
        headers=viewer.headers,
    )

    assert response.status_code == 403


# --- DELETE /projects/:id ---


def test_delete_project_as_admin(client: TestClient) -> None:
    owner = register(client, "owner@example.com")
    project = create_project(client, owner.headers)

    response = client.delete(f"/projects/{project['id']}", headers=owner.headers)

    assert response.status_code == 204
    assert client.get(f"/projects/{project['id']}", headers=owner.headers).status_code == 404


def test_delete_project_blocks_member(client: TestClient, db_session: Session) -> None:
    owner = register(client, "owner@example.com")
    member = register(client, "member@example.com")
    project = create_project(client, owner.headers)
    add_membership(db_session, uuid.UUID(project["id"]), member.id, UserRole.MEMBER)

    response = client.delete(f"/projects/{project['id']}", headers=member.headers)

    assert response.status_code == 403
