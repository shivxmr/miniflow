import uuid
from types import SimpleNamespace

from fastapi.testclient import TestClient

PASSWORD = "correct-horse-battery"


def register(client: TestClient, email: str, name: str = "Test User") -> SimpleNamespace:
    created = client.post(
        "/signup",
        json={"name": name, "email": email, "password": PASSWORD},
    )
    assert created.status_code == 201
    tokens = client.post("/login", json={"email": email, "password": PASSWORD})
    assert tokens.status_code == 200
    return SimpleNamespace(
        id=uuid.UUID(created.json()["id"]),
        email=email,
        headers={"Authorization": f"Bearer {tokens.json()['access_token']}"},
    )


def create_project(client: TestClient, headers: dict[str, str]) -> str:
    response = client.post("/projects", json={"name": "Roadmap"}, headers=headers)
    assert response.status_code == 201
    return response.json()["id"]


def add_member(
    client: TestClient,
    project_id: str,
    admin_headers: dict[str, str],
    email: str,
    role: str = "member",
):
    return client.post(
        f"/projects/{project_id}/members",
        json={"email": email, "role": role},
        headers=admin_headers,
    )


# --- POST /projects/:id/members ---


def test_admin_adds_member_by_email(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    teammate = register(client, "teammate@example.com", name="Tess")
    project_id = create_project(client, admin.headers)

    response = add_member(client, project_id, admin.headers, teammate.email)

    assert response.status_code == 201
    body = response.json()
    assert body["role"] == "member"
    assert body["user"]["email"] == "teammate@example.com"
    assert body["user"]["name"] == "Tess"


def test_add_member_defaults_to_member_role(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    teammate = register(client, "teammate@example.com")
    project_id = create_project(client, admin.headers)

    response = client.post(
        f"/projects/{project_id}/members",
        json={"email": teammate.email},
        headers=admin.headers,
    )

    assert response.status_code == 201
    assert response.json()["role"] == "member"


def test_add_member_with_viewer_role(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    teammate = register(client, "teammate@example.com")
    project_id = create_project(client, admin.headers)

    response = add_member(client, project_id, admin.headers, teammate.email, role="viewer")

    assert response.status_code == 201
    assert response.json()["role"] == "viewer"


def test_add_member_unknown_email_returns_404(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)

    response = add_member(client, project_id, admin.headers, "ghost@example.com")

    assert response.status_code == 404


def test_add_existing_member_returns_409(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    teammate = register(client, "teammate@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, teammate.email)

    response = add_member(client, project_id, admin.headers, teammate.email)

    assert response.status_code == 409


def test_member_cannot_add_members(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    member = register(client, "member@example.com")
    outsider = register(client, "outsider@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, member.email)

    response = add_member(client, project_id, member.headers, outsider.email)

    assert response.status_code == 403


# --- GET /projects/:id/members ---


def test_list_members_returns_everyone(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    teammate = register(client, "teammate@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, teammate.email)

    response = client.get(f"/projects/{project_id}/members", headers=admin.headers)

    assert response.status_code == 200
    emails = {m["user"]["email"] for m in response.json()}
    assert emails == {"admin@example.com", "teammate@example.com"}


def test_viewer_can_list_members(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    viewer = register(client, "viewer@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, viewer.email, role="viewer")

    response = client.get(f"/projects/{project_id}/members", headers=viewer.headers)

    assert response.status_code == 200
    assert len(response.json()) == 2


def test_non_member_cannot_list_members(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    outsider = register(client, "outsider@example.com")
    project_id = create_project(client, admin.headers)

    response = client.get(f"/projects/{project_id}/members", headers=outsider.headers)

    assert response.status_code == 403


# --- PUT /projects/:id/members/:userId ---


def test_admin_changes_member_role(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    teammate = register(client, "teammate@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, teammate.email)

    response = client.put(
        f"/projects/{project_id}/members/{teammate.id}",
        json={"role": "admin"},
        headers=admin.headers,
    )

    assert response.status_code == 200
    assert response.json()["role"] == "admin"


def test_change_role_of_non_member_returns_404(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)

    response = client.put(
        f"/projects/{project_id}/members/{uuid.uuid4()}",
        json={"role": "admin"},
        headers=admin.headers,
    )

    assert response.status_code == 404


def test_member_cannot_change_roles(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    member = register(client, "member@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, member.email)

    response = client.put(
        f"/projects/{project_id}/members/{member.id}",
        json={"role": "admin"},
        headers=member.headers,
    )

    assert response.status_code == 403


def test_cannot_demote_the_last_admin(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)

    response = client.put(
        f"/projects/{project_id}/members/{admin.id}",
        json={"role": "viewer"},
        headers=admin.headers,
    )

    assert response.status_code == 409


# --- DELETE /projects/:id/members/:userId ---


def test_admin_removes_member(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    teammate = register(client, "teammate@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, teammate.email)

    response = client.delete(
        f"/projects/{project_id}/members/{teammate.id}",
        headers=admin.headers,
    )

    assert response.status_code == 204
    members = client.get(f"/projects/{project_id}/members", headers=admin.headers).json()
    assert {m["user"]["email"] for m in members} == {"admin@example.com"}


def test_remove_non_member_returns_404(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)

    response = client.delete(
        f"/projects/{project_id}/members/{uuid.uuid4()}",
        headers=admin.headers,
    )

    assert response.status_code == 404


def test_member_cannot_remove_members(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    member = register(client, "member@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, member.email)

    response = client.delete(
        f"/projects/{project_id}/members/{admin.id}",
        headers=member.headers,
    )

    assert response.status_code == 403


def test_cannot_remove_the_last_admin(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)

    response = client.delete(
        f"/projects/{project_id}/members/{admin.id}",
        headers=admin.headers,
    )

    assert response.status_code == 409
