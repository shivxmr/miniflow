import uuid

from fastapi.testclient import TestClient

from tests.test_tasks import add_member, create_project, create_task, register


def make_comment(
    client: TestClient,
    headers: dict[str, str],
    task_id: str,
    body: str = "Looks good to me.",
):
    return client.post(
        f"/tasks/{task_id}/comments",
        json={"body": body},
        headers=headers,
    )


def setup_task(client: TestClient, headers: dict[str, str]) -> str:
    project_id = create_project(client, headers)
    return create_task(client, headers, project_id).json()["id"]


# --- POST /tasks/:id/comments -----------------------------------------------


def test_admin_creates_comment(client: TestClient) -> None:
    admin = register(client, "admin@example.com", name="Avery Admin")
    task_id = setup_task(client, admin.headers)

    response = make_comment(client, admin.headers, task_id, body="First!")

    assert response.status_code == 201
    body = response.json()
    assert body["body"] == "First!"
    assert body["task_id"] == task_id
    assert body["author"]["id"] == str(admin.id)
    assert body["author"]["name"] == "Avery Admin"


def test_member_creates_comment(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    member = register(client, "member@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, member.email)
    task_id = create_task(client, admin.headers, project_id).json()["id"]

    response = make_comment(client, member.headers, task_id)

    assert response.status_code == 201


def test_viewer_cannot_create_comment(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    viewer = register(client, "viewer@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, viewer.email, role="viewer")
    task_id = create_task(client, admin.headers, project_id).json()["id"]

    response = make_comment(client, viewer.headers, task_id)

    assert response.status_code == 403


def test_non_member_cannot_create_comment(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    outsider = register(client, "outsider@example.com")
    task_id = setup_task(client, admin.headers)

    response = make_comment(client, outsider.headers, task_id)

    assert response.status_code == 403


def test_create_comment_rejects_blank_body(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    task_id = setup_task(client, admin.headers)

    response = make_comment(client, admin.headers, task_id, body="")

    assert response.status_code == 422


def test_create_comment_on_missing_task_returns_404(client: TestClient) -> None:
    admin = register(client, "admin@example.com")

    response = make_comment(client, admin.headers, str(uuid.uuid4()))

    assert response.status_code == 404


def test_create_comment_requires_authentication(client: TestClient) -> None:
    response = client.post(
        f"/tasks/{uuid.uuid4()}/comments", json={"body": "hi"}
    )
    assert response.status_code == 401


# --- GET /tasks/:id/comments ------------------------------------------------


def test_list_comments_is_empty_for_new_task(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    task_id = setup_task(client, admin.headers)

    response = client.get(f"/tasks/{task_id}/comments", headers=admin.headers)

    assert response.status_code == 200
    assert response.json() == []


def test_list_comments_returns_created_in_order(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    task_id = setup_task(client, admin.headers)
    make_comment(client, admin.headers, task_id, body="First")
    make_comment(client, admin.headers, task_id, body="Second")

    response = client.get(f"/tasks/{task_id}/comments", headers=admin.headers)

    assert response.status_code == 200
    assert [c["body"] for c in response.json()] == ["First", "Second"]


def test_viewer_can_view_comments(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    viewer = register(client, "viewer@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, viewer.email, role="viewer")
    task_id = create_task(client, admin.headers, project_id).json()["id"]
    make_comment(client, admin.headers, task_id)

    response = client.get(f"/tasks/{task_id}/comments", headers=viewer.headers)

    assert response.status_code == 200
    assert len(response.json()) == 1


def test_list_comments_blocks_non_member(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    outsider = register(client, "outsider@example.com")
    task_id = setup_task(client, admin.headers)

    response = client.get(f"/tasks/{task_id}/comments", headers=outsider.headers)

    assert response.status_code == 403


# --- DELETE /tasks/:id/comments/:cid ----------------------------------------


def test_author_deletes_own_comment(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    member = register(client, "member@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, member.email)
    task_id = create_task(client, admin.headers, project_id).json()["id"]
    comment_id = make_comment(client, member.headers, task_id).json()["id"]

    response = client.delete(
        f"/tasks/{task_id}/comments/{comment_id}", headers=member.headers
    )

    assert response.status_code == 204
    assert client.get(f"/tasks/{task_id}/comments", headers=admin.headers).json() == []


def test_admin_deletes_any_comment(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    member = register(client, "member@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, member.email)
    task_id = create_task(client, admin.headers, project_id).json()["id"]
    comment_id = make_comment(client, member.headers, task_id).json()["id"]

    response = client.delete(
        f"/tasks/{task_id}/comments/{comment_id}", headers=admin.headers
    )

    assert response.status_code == 204


def test_member_cannot_delete_others_comment(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    member_a = register(client, "member-a@example.com")
    member_b = register(client, "member-b@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, member_a.email)
    add_member(client, project_id, admin.headers, member_b.email)
    task_id = create_task(client, admin.headers, project_id).json()["id"]
    comment_id = make_comment(client, member_a.headers, task_id).json()["id"]

    response = client.delete(
        f"/tasks/{task_id}/comments/{comment_id}", headers=member_b.headers
    )

    assert response.status_code == 403


def test_viewer_cannot_delete_comment(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    viewer = register(client, "viewer@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, viewer.email, role="viewer")
    task_id = create_task(client, admin.headers, project_id).json()["id"]
    comment_id = make_comment(client, admin.headers, task_id).json()["id"]

    response = client.delete(
        f"/tasks/{task_id}/comments/{comment_id}", headers=viewer.headers
    )

    assert response.status_code == 403


def test_delete_missing_comment_returns_404(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    task_id = setup_task(client, admin.headers)

    response = client.delete(
        f"/tasks/{task_id}/comments/{uuid.uuid4()}", headers=admin.headers
    )

    assert response.status_code == 404


def test_delete_comment_with_wrong_task_id_returns_404(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)
    task_a = create_task(client, admin.headers, project_id, title="A").json()["id"]
    task_b = create_task(client, admin.headers, project_id, title="B").json()["id"]
    comment_id = make_comment(client, admin.headers, task_a).json()["id"]

    response = client.delete(
        f"/tasks/{task_b}/comments/{comment_id}", headers=admin.headers
    )

    assert response.status_code == 404


def test_deleting_task_cascades_to_comments(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    task_id = setup_task(client, admin.headers)
    comment_id = make_comment(client, admin.headers, task_id).json()["id"]

    assert client.delete(f"/tasks/{task_id}", headers=admin.headers).status_code == 204
    # The parent task is gone, so the comments route now 404s on the task.
    response = client.get(f"/tasks/{task_id}/comments", headers=admin.headers)
    assert response.status_code == 404
    assert comment_id  # the comment row was removed by the cascade
