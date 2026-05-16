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
) -> None:
    response = client.post(
        f"/projects/{project_id}/members",
        json={"email": email, "role": role},
        headers=admin_headers,
    )
    assert response.status_code == 201


def create_task(
    client: TestClient,
    headers: dict[str, str],
    project_id: str,
    **fields: object,
):
    payload = {"project_id": project_id, "title": "Ship it", **fields}
    return client.post("/tasks", json=payload, headers=headers)


# --- POST /tasks ---


def test_admin_creates_task(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)

    response = create_task(
        client,
        admin.headers,
        project_id,
        title="Design schema",
        description="Lock the data model",
        priority="high",
        status="in_progress",
        due_date="2026-06-01",
    )

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Design schema"
    assert body["priority"] == "high"
    assert body["status"] == "in_progress"
    assert body["due_date"] == "2026-06-01"
    assert body["created_by"] == str(admin.id)


def test_member_creates_task(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    member = register(client, "member@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, member.email)

    response = create_task(client, member.headers, project_id)

    assert response.status_code == 201


def test_viewer_cannot_create_task(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    viewer = register(client, "viewer@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, viewer.email, role="viewer")

    response = create_task(client, viewer.headers, project_id)

    assert response.status_code == 403


def test_non_member_cannot_create_task(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    outsider = register(client, "outsider@example.com")
    project_id = create_project(client, admin.headers)

    response = create_task(client, outsider.headers, project_id)

    assert response.status_code == 403


def test_create_task_in_missing_project_returns_404(client: TestClient) -> None:
    admin = register(client, "admin@example.com")

    response = create_task(client, admin.headers, str(uuid.uuid4()))

    assert response.status_code == 404


def test_create_task_requires_authentication(client: TestClient) -> None:
    response = client.post("/tasks", json={"project_id": str(uuid.uuid4()), "title": "x"})
    assert response.status_code == 401


def test_create_task_rejects_blank_title(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)

    response = create_task(client, admin.headers, project_id, title="")

    assert response.status_code == 422


def test_create_task_with_assignee(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    member = register(client, "member@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, member.email)

    response = create_task(client, admin.headers, project_id, assigned_to=str(member.id))

    assert response.status_code == 201
    assert response.json()["assigned_to"] == str(member.id)


def test_create_task_assignee_must_be_project_member(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    outsider = register(client, "outsider@example.com")
    project_id = create_project(client, admin.headers)

    response = create_task(client, admin.headers, project_id, assigned_to=str(outsider.id))

    assert response.status_code == 400


# --- GET /tasks/:id ---


def test_get_task_as_member(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)
    task_id = create_task(client, admin.headers, project_id).json()["id"]

    response = client.get(f"/tasks/{task_id}", headers=admin.headers)

    assert response.status_code == 200
    assert response.json()["id"] == task_id


def test_get_task_blocks_non_member(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    outsider = register(client, "outsider@example.com")
    project_id = create_project(client, admin.headers)
    task_id = create_task(client, admin.headers, project_id).json()["id"]

    response = client.get(f"/tasks/{task_id}", headers=outsider.headers)

    assert response.status_code == 403


def test_get_missing_task_returns_404(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    response = client.get(f"/tasks/{uuid.uuid4()}", headers=admin.headers)
    assert response.status_code == 404


# --- GET /projects/:id/tasks ---


def test_list_tasks_returns_only_project_tasks(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)
    other_project_id = create_project(client, admin.headers)
    create_task(client, admin.headers, project_id, title="In project")
    create_task(client, admin.headers, other_project_id, title="Elsewhere")

    response = client.get(f"/projects/{project_id}/tasks", headers=admin.headers)

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert [t["title"] for t in body["items"]] == ["In project"]


def test_list_tasks_filter_by_status(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)
    create_task(client, admin.headers, project_id, title="A", status="todo")
    create_task(client, admin.headers, project_id, title="B", status="done")

    response = client.get(
        f"/projects/{project_id}/tasks",
        params={"status": "done"},
        headers=admin.headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["title"] == "B"


def test_list_tasks_filter_by_priority(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)
    create_task(client, admin.headers, project_id, title="A", priority="low")
    create_task(client, admin.headers, project_id, title="B", priority="high")

    response = client.get(
        f"/projects/{project_id}/tasks",
        params={"priority": "high"},
        headers=admin.headers,
    )

    assert response.status_code == 200
    assert [t["title"] for t in response.json()["items"]] == ["B"]


def test_list_tasks_filter_by_assignee(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    member = register(client, "member@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, member.email)
    create_task(client, admin.headers, project_id, title="Assigned", assigned_to=str(member.id))
    create_task(client, admin.headers, project_id, title="Unassigned")

    response = client.get(
        f"/projects/{project_id}/tasks",
        params={"assigned_to": str(member.id)},
        headers=admin.headers,
    )

    assert response.status_code == 200
    assert [t["title"] for t in response.json()["items"]] == ["Assigned"]


def test_list_tasks_is_paginated(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)
    for index in range(3):
        create_task(client, admin.headers, project_id, title=f"Task {index}")

    first = client.get(
        f"/projects/{project_id}/tasks",
        params={"limit": 2, "offset": 0},
        headers=admin.headers,
    )
    second = client.get(
        f"/projects/{project_id}/tasks",
        params={"limit": 2, "offset": 2},
        headers=admin.headers,
    )

    assert first.json()["total"] == 3
    assert len(first.json()["items"]) == 2
    assert len(second.json()["items"]) == 1


def test_list_tasks_blocks_non_member(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    outsider = register(client, "outsider@example.com")
    project_id = create_project(client, admin.headers)

    response = client.get(f"/projects/{project_id}/tasks", headers=outsider.headers)

    assert response.status_code == 403


# --- PUT /tasks/:id ---


def test_admin_updates_any_task(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    member = register(client, "member@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, member.email)
    task_id = create_task(client, member.headers, project_id).json()["id"]

    response = client.put(
        f"/tasks/{task_id}",
        json={"status": "done"},
        headers=admin.headers,
    )

    assert response.status_code == 200
    assert response.json()["status"] == "done"


def test_member_updates_own_task(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    member = register(client, "member@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, member.email)
    task_id = create_task(client, member.headers, project_id).json()["id"]

    response = client.put(
        f"/tasks/{task_id}",
        json={"title": "Renamed"},
        headers=member.headers,
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Renamed"


def test_member_updates_task_assigned_to_them(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    member = register(client, "member@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, member.email)
    task_id = create_task(
        client, admin.headers, project_id, assigned_to=str(member.id)
    ).json()["id"]

    response = client.put(
        f"/tasks/{task_id}",
        json={"status": "in_progress"},
        headers=member.headers,
    )

    assert response.status_code == 200


def test_member_cannot_update_unrelated_task(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    member = register(client, "member@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, member.email)
    task_id = create_task(client, admin.headers, project_id).json()["id"]

    response = client.put(
        f"/tasks/{task_id}",
        json={"title": "Hijacked"},
        headers=member.headers,
    )

    assert response.status_code == 403


def test_viewer_cannot_update_task(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    viewer = register(client, "viewer@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, viewer.email, role="viewer")
    task_id = create_task(client, admin.headers, project_id).json()["id"]

    response = client.put(
        f"/tasks/{task_id}",
        json={"title": "Nope"},
        headers=viewer.headers,
    )

    assert response.status_code == 403


def test_update_task_assignee_must_be_member(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    outsider = register(client, "outsider@example.com")
    project_id = create_project(client, admin.headers)
    task_id = create_task(client, admin.headers, project_id).json()["id"]

    response = client.put(
        f"/tasks/{task_id}",
        json={"assigned_to": str(outsider.id)},
        headers=admin.headers,
    )

    assert response.status_code == 400


# --- DELETE /tasks/:id ---


def test_admin_deletes_any_task(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    member = register(client, "member@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, member.email)
    task_id = create_task(client, member.headers, project_id).json()["id"]

    response = client.delete(f"/tasks/{task_id}", headers=admin.headers)

    assert response.status_code == 204
    assert client.get(f"/tasks/{task_id}", headers=admin.headers).status_code == 404


def test_member_deletes_own_task(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    member = register(client, "member@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, member.email)
    task_id = create_task(client, member.headers, project_id).json()["id"]

    response = client.delete(f"/tasks/{task_id}", headers=member.headers)

    assert response.status_code == 204


def test_member_cannot_delete_unrelated_task(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    member = register(client, "member@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, member.email)
    task_id = create_task(client, admin.headers, project_id).json()["id"]

    response = client.delete(f"/tasks/{task_id}", headers=member.headers)

    assert response.status_code == 403


def test_delete_missing_task_returns_404(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    response = client.delete(f"/tasks/{uuid.uuid4()}", headers=admin.headers)
    assert response.status_code == 404
