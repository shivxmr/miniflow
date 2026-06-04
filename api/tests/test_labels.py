import uuid
from types import SimpleNamespace

from fastapi.testclient import TestClient

PASSWORD = "correct-horse-battery"
COLOR = "#E11D48"
COLOR_2 = "#2563EB"


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


def create_label(
    client: TestClient,
    headers: dict[str, str],
    project_id: str,
    name: str = "bug",
    color: str = COLOR,
):
    return client.post(
        f"/projects/{project_id}/labels",
        json={"name": name, "color": color},
        headers=headers,
    )


def create_task(
    client: TestClient, headers: dict[str, str], project_id: str, **fields: object
) -> str:
    payload = {"project_id": project_id, "title": "Ship it", **fields}
    response = client.post("/tasks", json=payload, headers=headers)
    assert response.status_code == 201
    return response.json()["id"]


# --- POST /projects/:id/labels ---


def test_admin_creates_label(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)

    response = create_label(client, admin.headers, project_id, name="frontend")

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "frontend"
    assert body["color"] == COLOR
    assert body["project_id"] == project_id
    assert "id" in body


def test_member_cannot_create_label(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    member = register(client, "member@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, member.email)

    response = create_label(client, member.headers, project_id)

    assert response.status_code == 403


def test_non_member_cannot_create_label(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    outsider = register(client, "outsider@example.com")
    project_id = create_project(client, admin.headers)

    response = create_label(client, outsider.headers, project_id)

    assert response.status_code == 403


def test_create_label_rejects_blank_name(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)

    response = create_label(client, admin.headers, project_id, name="")

    assert response.status_code == 422


def test_create_label_rejects_overlong_name(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)

    response = create_label(client, admin.headers, project_id, name="x" * 41)

    assert response.status_code == 422


def test_create_label_rejects_unknown_color(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)

    response = create_label(client, admin.headers, project_id, color="#123456")

    assert response.status_code == 422


def test_create_label_rejects_duplicate_name(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)
    create_label(client, admin.headers, project_id, name="bug")

    response = create_label(client, admin.headers, project_id, name="bug", color=COLOR_2)

    assert response.status_code == 409


def test_same_name_allowed_in_different_projects(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_a = create_project(client, admin.headers)
    project_b = create_project(client, admin.headers)
    create_label(client, admin.headers, project_a, name="bug")

    response = create_label(client, admin.headers, project_b, name="bug")

    assert response.status_code == 201


# --- GET /projects/:id/labels ---


def test_list_labels(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)
    create_label(client, admin.headers, project_id, name="bug")
    create_label(client, admin.headers, project_id, name="chore", color=COLOR_2)

    response = client.get(f"/projects/{project_id}/labels", headers=admin.headers)

    assert response.status_code == 200
    names = {label["name"] for label in response.json()}
    assert names == {"bug", "chore"}


def test_viewer_can_list_labels(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    viewer = register(client, "viewer@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, viewer.email, role="viewer")
    create_label(client, admin.headers, project_id, name="bug")

    response = client.get(f"/projects/{project_id}/labels", headers=viewer.headers)

    assert response.status_code == 200
    assert len(response.json()) == 1


def test_list_labels_blocks_non_member(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    outsider = register(client, "outsider@example.com")
    project_id = create_project(client, admin.headers)

    response = client.get(f"/projects/{project_id}/labels", headers=outsider.headers)

    assert response.status_code == 403


# --- PUT /projects/:id/labels/:label_id ---


def test_admin_updates_label(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)
    label_id = create_label(client, admin.headers, project_id, name="bug").json()["id"]

    response = client.put(
        f"/projects/{project_id}/labels/{label_id}",
        json={"name": "defect", "color": COLOR_2},
        headers=admin.headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "defect"
    assert body["color"] == COLOR_2


def test_member_cannot_update_label(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    member = register(client, "member@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, member.email)
    label_id = create_label(client, admin.headers, project_id).json()["id"]

    response = client.put(
        f"/projects/{project_id}/labels/{label_id}",
        json={"name": "defect"},
        headers=member.headers,
    )

    assert response.status_code == 403


def test_update_missing_label_returns_404(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)

    response = client.put(
        f"/projects/{project_id}/labels/{uuid.uuid4()}",
        json={"name": "defect"},
        headers=admin.headers,
    )

    assert response.status_code == 404


def test_update_label_rejects_duplicate_name(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)
    create_label(client, admin.headers, project_id, name="bug")
    other_id = create_label(client, admin.headers, project_id, name="chore").json()["id"]

    response = client.put(
        f"/projects/{project_id}/labels/{other_id}",
        json={"name": "bug"},
        headers=admin.headers,
    )

    assert response.status_code == 409


# --- DELETE /projects/:id/labels/:label_id ---


def test_admin_deletes_label(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)
    label_id = create_label(client, admin.headers, project_id).json()["id"]

    response = client.delete(f"/projects/{project_id}/labels/{label_id}", headers=admin.headers)

    assert response.status_code == 204
    listing = client.get(f"/projects/{project_id}/labels", headers=admin.headers)
    assert listing.json() == []


def test_member_cannot_delete_label(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    member = register(client, "member@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, member.email)
    label_id = create_label(client, admin.headers, project_id).json()["id"]

    response = client.delete(f"/projects/{project_id}/labels/{label_id}", headers=member.headers)

    assert response.status_code == 403


def test_deleting_label_removes_it_from_tasks(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)
    label_id = create_label(client, admin.headers, project_id).json()["id"]
    task_id = create_task(client, admin.headers, project_id)
    client.post(
        f"/tasks/{task_id}/labels",
        json={"label_id": label_id},
        headers=admin.headers,
    )

    client.delete(f"/projects/{project_id}/labels/{label_id}", headers=admin.headers)

    task = client.get(f"/tasks/{task_id}", headers=admin.headers)
    assert task.json()["labels"] == []


# --- POST /tasks/:id/labels ---


def test_admin_applies_label_to_task(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)
    label_id = create_label(client, admin.headers, project_id, name="bug").json()["id"]
    task_id = create_task(client, admin.headers, project_id)

    response = client.post(
        f"/tasks/{task_id}/labels",
        json={"label_id": label_id},
        headers=admin.headers,
    )

    assert response.status_code == 200
    labels = response.json()["labels"]
    assert [label["name"] for label in labels] == ["bug"]


def test_member_applies_label_to_task_they_do_not_own(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    member = register(client, "member@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, member.email)
    label_id = create_label(client, admin.headers, project_id).json()["id"]
    task_id = create_task(client, admin.headers, project_id)

    response = client.post(
        f"/tasks/{task_id}/labels",
        json={"label_id": label_id},
        headers=member.headers,
    )

    assert response.status_code == 200


def test_viewer_cannot_apply_label(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    viewer = register(client, "viewer@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, viewer.email, role="viewer")
    label_id = create_label(client, admin.headers, project_id).json()["id"]
    task_id = create_task(client, admin.headers, project_id)

    response = client.post(
        f"/tasks/{task_id}/labels",
        json={"label_id": label_id},
        headers=viewer.headers,
    )

    assert response.status_code == 403


def test_applying_label_is_idempotent(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)
    label_id = create_label(client, admin.headers, project_id).json()["id"]
    task_id = create_task(client, admin.headers, project_id)
    body = {"label_id": label_id}

    client.post(f"/tasks/{task_id}/labels", json=body, headers=admin.headers)
    response = client.post(f"/tasks/{task_id}/labels", json=body, headers=admin.headers)

    assert response.status_code == 200
    assert len(response.json()["labels"]) == 1


def test_cannot_apply_label_from_other_project(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_a = create_project(client, admin.headers)
    project_b = create_project(client, admin.headers)
    label_id = create_label(client, admin.headers, project_b).json()["id"]
    task_id = create_task(client, admin.headers, project_a)

    response = client.post(
        f"/tasks/{task_id}/labels",
        json={"label_id": label_id},
        headers=admin.headers,
    )

    assert response.status_code == 400


def test_cannot_apply_more_than_five_labels(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)
    task_id = create_task(client, admin.headers, project_id)
    for i in range(5):
        label_id = create_label(client, admin.headers, project_id, name=f"label-{i}").json()["id"]
        applied = client.post(
            f"/tasks/{task_id}/labels",
            json={"label_id": label_id},
            headers=admin.headers,
        )
        assert applied.status_code == 200

    sixth = create_label(client, admin.headers, project_id, name="sixth").json()["id"]
    response = client.post(
        f"/tasks/{task_id}/labels",
        json={"label_id": sixth},
        headers=admin.headers,
    )

    assert response.status_code == 409


# --- DELETE /tasks/:id/labels/:label_id ---


def test_remove_label_from_task(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)
    label_id = create_label(client, admin.headers, project_id).json()["id"]
    task_id = create_task(client, admin.headers, project_id)
    client.post(
        f"/tasks/{task_id}/labels",
        json={"label_id": label_id},
        headers=admin.headers,
    )

    response = client.delete(f"/tasks/{task_id}/labels/{label_id}", headers=admin.headers)

    assert response.status_code == 200
    assert response.json()["labels"] == []


def test_viewer_cannot_remove_label(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    viewer = register(client, "viewer@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, viewer.email, role="viewer")
    label_id = create_label(client, admin.headers, project_id).json()["id"]
    task_id = create_task(client, admin.headers, project_id)
    client.post(
        f"/tasks/{task_id}/labels",
        json={"label_id": label_id},
        headers=admin.headers,
    )

    response = client.delete(f"/tasks/{task_id}/labels/{label_id}", headers=viewer.headers)

    assert response.status_code == 403


# --- TaskRead carries labels & filtering ---


def test_task_read_includes_labels(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)
    label_id = create_label(client, admin.headers, project_id, name="bug").json()["id"]
    task_id = create_task(client, admin.headers, project_id)
    client.post(
        f"/tasks/{task_id}/labels",
        json={"label_id": label_id},
        headers=admin.headers,
    )

    listing = client.get(f"/projects/{project_id}/tasks", headers=admin.headers)

    item = listing.json()["items"][0]
    assert [label["name"] for label in item["labels"]] == ["bug"]


def test_filter_tasks_by_single_label(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)
    bug = create_label(client, admin.headers, project_id, name="bug").json()["id"]
    tagged = create_task(client, admin.headers, project_id, title="Tagged")
    create_task(client, admin.headers, project_id, title="Untagged")
    client.post(f"/tasks/{tagged}/labels", json={"label_id": bug}, headers=admin.headers)

    response = client.get(
        f"/projects/{project_id}/tasks",
        params={"label_id": bug},
        headers=admin.headers,
    )

    assert response.status_code == 200
    assert [t["title"] for t in response.json()["items"]] == ["Tagged"]


def test_filter_tasks_by_multiple_labels_is_or(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)
    bug = create_label(client, admin.headers, project_id, name="bug").json()["id"]
    chore = create_label(client, admin.headers, project_id, name="chore", color=COLOR_2).json()[
        "id"
    ]
    task_bug = create_task(client, admin.headers, project_id, title="Bug task")
    task_chore = create_task(client, admin.headers, project_id, title="Chore task")
    create_task(client, admin.headers, project_id, title="No label")
    client.post(f"/tasks/{task_bug}/labels", json={"label_id": bug}, headers=admin.headers)
    client.post(f"/tasks/{task_chore}/labels", json={"label_id": chore}, headers=admin.headers)

    response = client.get(
        f"/projects/{project_id}/tasks",
        params=[("label_id", bug), ("label_id", chore)],
        headers=admin.headers,
    )

    assert response.status_code == 200
    titles = {t["title"] for t in response.json()["items"]}
    assert titles == {"Bug task", "Chore task"}


def test_filter_by_label_does_not_duplicate_tasks(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)
    bug = create_label(client, admin.headers, project_id, name="bug").json()["id"]
    chore = create_label(client, admin.headers, project_id, name="chore", color=COLOR_2).json()[
        "id"
    ]
    task_id = create_task(client, admin.headers, project_id, title="Both")
    client.post(f"/tasks/{task_id}/labels", json={"label_id": bug}, headers=admin.headers)
    client.post(f"/tasks/{task_id}/labels", json={"label_id": chore}, headers=admin.headers)

    response = client.get(
        f"/projects/{project_id}/tasks",
        params=[("label_id", bug), ("label_id", chore)],
        headers=admin.headers,
    )

    assert response.json()["total"] == 1
    assert len(response.json()["items"]) == 1
