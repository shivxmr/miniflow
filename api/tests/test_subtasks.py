import json
import uuid

import pytest
from fastapi.testclient import TestClient

from app.services import ai
from app.services.ai import MAX_SUBTASKS, AIInvalidResponse, _extract_titles
from tests.test_tasks import add_member, create_project, create_task, register


def make_subtask(
    client: TestClient,
    headers: dict[str, str],
    task_id: str,
    title: str = "Write the tests",
):
    return client.post(
        f"/tasks/{task_id}/subtasks",
        json={"title": title},
        headers=headers,
    )


def setup_task(client: TestClient, headers: dict[str, str]) -> str:
    project_id = create_project(client, headers)
    return create_task(client, headers, project_id).json()["id"]


# --- POST /tasks/:id/subtasks -----------------------------------------------


def test_admin_creates_subtask(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    task_id = setup_task(client, admin.headers)

    response = make_subtask(client, admin.headers, task_id, title="Draft the schema")

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Draft the schema"
    assert body["is_done"] is False
    assert body["task_id"] == task_id


def test_member_creates_subtask(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    member = register(client, "member@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, member.email)
    task_id = create_task(client, admin.headers, project_id).json()["id"]

    response = make_subtask(client, member.headers, task_id)

    assert response.status_code == 201


def test_viewer_cannot_create_subtask(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    viewer = register(client, "viewer@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, viewer.email, role="viewer")
    task_id = create_task(client, admin.headers, project_id).json()["id"]

    response = make_subtask(client, viewer.headers, task_id)

    assert response.status_code == 403


def test_non_member_cannot_create_subtask(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    outsider = register(client, "outsider@example.com")
    task_id = setup_task(client, admin.headers)

    response = make_subtask(client, outsider.headers, task_id)

    assert response.status_code == 403


def test_create_subtask_rejects_blank_title(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    task_id = setup_task(client, admin.headers)

    response = make_subtask(client, admin.headers, task_id, title="")

    assert response.status_code == 422


def test_create_subtask_on_missing_task_returns_404(client: TestClient) -> None:
    admin = register(client, "admin@example.com")

    response = make_subtask(client, admin.headers, str(uuid.uuid4()))

    assert response.status_code == 404


def test_create_subtask_requires_authentication(client: TestClient) -> None:
    response = client.post(
        f"/tasks/{uuid.uuid4()}/subtasks", json={"title": "x"}
    )
    assert response.status_code == 401


# --- GET /tasks/:id/subtasks ------------------------------------------------


def test_list_subtasks_is_empty_for_new_task(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    task_id = setup_task(client, admin.headers)

    response = client.get(f"/tasks/{task_id}/subtasks", headers=admin.headers)

    assert response.status_code == 200
    assert response.json() == []


def test_list_subtasks_returns_created_in_order(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    task_id = setup_task(client, admin.headers)
    make_subtask(client, admin.headers, task_id, title="First")
    make_subtask(client, admin.headers, task_id, title="Second")

    response = client.get(f"/tasks/{task_id}/subtasks", headers=admin.headers)

    assert response.status_code == 200
    assert [s["title"] for s in response.json()] == ["First", "Second"]


def test_viewer_can_view_subtasks(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    viewer = register(client, "viewer@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, viewer.email, role="viewer")
    task_id = create_task(client, admin.headers, project_id).json()["id"]
    make_subtask(client, admin.headers, task_id)

    response = client.get(f"/tasks/{task_id}/subtasks", headers=viewer.headers)

    assert response.status_code == 200
    assert len(response.json()) == 1


def test_list_subtasks_blocks_non_member(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    outsider = register(client, "outsider@example.com")
    task_id = setup_task(client, admin.headers)

    response = client.get(f"/tasks/{task_id}/subtasks", headers=outsider.headers)

    assert response.status_code == 403


# --- PATCH /tasks/:id/subtasks/:sid -----------------------------------------


def test_toggle_subtask_done(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    task_id = setup_task(client, admin.headers)
    subtask_id = make_subtask(client, admin.headers, task_id).json()["id"]

    response = client.patch(
        f"/tasks/{task_id}/subtasks/{subtask_id}",
        json={"is_done": True},
        headers=admin.headers,
    )

    assert response.status_code == 200
    assert response.json()["is_done"] is True


def test_rename_subtask(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    task_id = setup_task(client, admin.headers)
    subtask_id = make_subtask(client, admin.headers, task_id).json()["id"]

    response = client.patch(
        f"/tasks/{task_id}/subtasks/{subtask_id}",
        json={"title": "Renamed subtask"},
        headers=admin.headers,
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Renamed subtask"


def test_member_modifies_subtask_of_own_task(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    member = register(client, "member@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, member.email)
    task_id = create_task(client, member.headers, project_id).json()["id"]
    subtask_id = make_subtask(client, member.headers, task_id).json()["id"]

    response = client.patch(
        f"/tasks/{task_id}/subtasks/{subtask_id}",
        json={"is_done": True},
        headers=member.headers,
    )

    assert response.status_code == 200


def test_member_cannot_modify_subtask_of_unrelated_task(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    member = register(client, "member@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, member.email)
    task_id = create_task(client, admin.headers, project_id).json()["id"]
    subtask_id = make_subtask(client, admin.headers, task_id).json()["id"]

    response = client.patch(
        f"/tasks/{task_id}/subtasks/{subtask_id}",
        json={"is_done": True},
        headers=member.headers,
    )

    assert response.status_code == 403


def test_viewer_cannot_modify_subtask(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    viewer = register(client, "viewer@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, viewer.email, role="viewer")
    task_id = create_task(client, admin.headers, project_id).json()["id"]
    subtask_id = make_subtask(client, admin.headers, task_id).json()["id"]

    response = client.patch(
        f"/tasks/{task_id}/subtasks/{subtask_id}",
        json={"is_done": True},
        headers=viewer.headers,
    )

    assert response.status_code == 403


def test_patch_subtask_with_wrong_task_id_returns_404(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)
    task_a = create_task(client, admin.headers, project_id, title="A").json()["id"]
    task_b = create_task(client, admin.headers, project_id, title="B").json()["id"]
    subtask_id = make_subtask(client, admin.headers, task_a).json()["id"]

    response = client.patch(
        f"/tasks/{task_b}/subtasks/{subtask_id}",
        json={"is_done": True},
        headers=admin.headers,
    )

    assert response.status_code == 404


# --- DELETE /tasks/:id/subtasks/:sid ----------------------------------------


def test_admin_deletes_subtask(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    task_id = setup_task(client, admin.headers)
    subtask_id = make_subtask(client, admin.headers, task_id).json()["id"]

    response = client.delete(
        f"/tasks/{task_id}/subtasks/{subtask_id}", headers=admin.headers
    )

    assert response.status_code == 204
    assert client.get(f"/tasks/{task_id}/subtasks", headers=admin.headers).json() == []


def test_delete_missing_subtask_returns_404(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    task_id = setup_task(client, admin.headers)

    response = client.delete(
        f"/tasks/{task_id}/subtasks/{uuid.uuid4()}", headers=admin.headers
    )

    assert response.status_code == 404


def test_viewer_cannot_delete_subtask(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    viewer = register(client, "viewer@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, viewer.email, role="viewer")
    task_id = create_task(client, admin.headers, project_id).json()["id"]
    subtask_id = make_subtask(client, admin.headers, task_id).json()["id"]

    response = client.delete(
        f"/tasks/{task_id}/subtasks/{subtask_id}", headers=viewer.headers
    )

    assert response.status_code == 403


def test_deleting_task_cascades_to_subtasks(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    task_id = setup_task(client, admin.headers)
    subtask_id = make_subtask(client, admin.headers, task_id).json()["id"]

    assert client.delete(f"/tasks/{task_id}", headers=admin.headers).status_code == 204
    # The parent task is gone, so the subtask route now 404s on the task.
    response = client.get(f"/tasks/{task_id}/subtasks", headers=admin.headers)
    assert response.status_code == 404
    assert subtask_id  # the subtask row was removed by the cascade


# --- POST /tasks/:id/subtasks/generate (AI, mocked) -------------------------


def test_generate_subtasks_success(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin = register(client, "admin@example.com")
    task_id = setup_task(client, admin.headers)

    monkeypatch.setattr(
        ai, "generate_subtask_titles", lambda title, desc: ["Step one", "Step two"]
    )

    response = client.post(
        f"/tasks/{task_id}/subtasks/generate", headers=admin.headers
    )

    assert response.status_code == 200
    assert response.json()["suggestions"] == ["Step one", "Step two"]


def test_generate_subtasks_does_not_persist(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin = register(client, "admin@example.com")
    task_id = setup_task(client, admin.headers)
    monkeypatch.setattr(ai, "generate_subtask_titles", lambda title, desc: ["A", "B"])

    client.post(f"/tasks/{task_id}/subtasks/generate", headers=admin.headers)

    # Suggestions are returned for review only — nothing is saved yet.
    assert client.get(f"/tasks/{task_id}/subtasks", headers=admin.headers).json() == []


def test_generate_subtasks_viewer_forbidden(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    viewer = register(client, "viewer@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, viewer.email, role="viewer")
    task_id = create_task(client, admin.headers, project_id).json()["id"]

    response = client.post(
        f"/tasks/{task_id}/subtasks/generate", headers=viewer.headers
    )

    assert response.status_code == 403


def test_generate_subtasks_not_configured_returns_503(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin = register(client, "admin@example.com")
    task_id = setup_task(client, admin.headers)

    def raise_not_configured(title: str, desc: str | None):
        raise ai.AINotConfigured("AI subtask generation is not configured.")

    monkeypatch.setattr(ai, "generate_subtask_titles", raise_not_configured)

    response = client.post(
        f"/tasks/{task_id}/subtasks/generate", headers=admin.headers
    )

    assert response.status_code == 503


def test_generate_subtasks_invalid_response_returns_422(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin = register(client, "admin@example.com")
    task_id = setup_task(client, admin.headers)

    def raise_invalid(title: str, desc: str | None):
        raise ai.AIInvalidResponse("The AI returned an unexpected response.")

    monkeypatch.setattr(ai, "generate_subtask_titles", raise_invalid)

    response = client.post(
        f"/tasks/{task_id}/subtasks/generate", headers=admin.headers
    )

    assert response.status_code == 422


def test_generate_subtasks_service_error_returns_502(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin = register(client, "admin@example.com")
    task_id = setup_task(client, admin.headers)

    def raise_service(title: str, desc: str | None):
        raise ai.AIServiceError("Could not reach the AI service.")

    monkeypatch.setattr(ai, "generate_subtask_titles", raise_service)

    response = client.post(
        f"/tasks/{task_id}/subtasks/generate", headers=admin.headers
    )

    assert response.status_code == 502


def test_generate_subtasks_missing_task_returns_404(client: TestClient) -> None:
    admin = register(client, "admin@example.com")

    response = client.post(
        f"/tasks/{uuid.uuid4()}/subtasks/generate", headers=admin.headers
    )

    assert response.status_code == 404


# --- AI response parsing (unit) ---------------------------------------------


def test_extract_titles_parses_plain_json_array() -> None:
    assert _extract_titles('["One", "Two", "Three"]') == ["One", "Two", "Three"]


def test_extract_titles_tolerates_markdown_fence() -> None:
    content = '```json\n["Alpha", "Beta"]\n```'
    assert _extract_titles(content) == ["Alpha", "Beta"]


def test_extract_titles_tolerates_surrounding_prose() -> None:
    content = 'Here are the subtasks:\n["Do X", "Do Y"]\nHope that helps!'
    assert _extract_titles(content) == ["Do X", "Do Y"]


def test_extract_titles_caps_at_max_and_drops_blanks() -> None:
    items = [f"Task {i}" for i in range(20)]
    items.append("   ")
    result = _extract_titles(json.dumps(items))
    assert len(result) == MAX_SUBTASKS
    assert "" not in result


def test_extract_titles_rejects_unparseable() -> None:
    with pytest.raises(AIInvalidResponse):
        _extract_titles("the model said no")


def test_extract_titles_rejects_empty_list() -> None:
    with pytest.raises(AIInvalidResponse):
        _extract_titles("[]")
