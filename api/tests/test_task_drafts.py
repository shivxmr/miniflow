import json
import uuid

import pytest
from fastapi.testclient import TestClient

from app.services import ai
from app.services.ai import MAX_TASK_DRAFTS, AIInvalidResponse, _extract_task_drafts
from tests.test_tasks import add_member, create_project, register

# --- _extract_task_drafts (unit) --------------------------------------------


def test_extract_drafts_parses_objects() -> None:
    content = json.dumps(
        [
            {
                "title": "Set up CI",
                "description": "Run tests on push",
                "priority": "high",
            },
            {"title": "Write docs", "description": "", "priority": "low"},
        ]
    )
    assert _extract_task_drafts(content) == [
        {
            "title": "Set up CI",
            "description": "Run tests on push",
            "priority": "high",
        },
        {"title": "Write docs", "description": "", "priority": "low"},
    ]


def test_extract_drafts_tolerates_markdown_fence() -> None:
    content = '```json\n[{"title": "A", "description": "d", "priority": "medium"}]\n```'
    assert _extract_task_drafts(content)[0]["title"] == "A"


def test_extract_drafts_tolerates_surrounding_prose() -> None:
    content = 'Here are the tasks:\n[{"title": "A"}]\nHope that helps!'
    assert _extract_task_drafts(content)[0]["title"] == "A"


def test_extract_drafts_clamps_unknown_priority_to_medium() -> None:
    content = json.dumps([{"title": "A", "priority": "urgent"}])
    assert _extract_task_drafts(content)[0]["priority"] == "medium"


def test_extract_drafts_normalizes_priority_case() -> None:
    content = json.dumps([{"title": "A", "priority": "HIGH"}])
    assert _extract_task_drafts(content)[0]["priority"] == "high"


def test_extract_drafts_defaults_missing_fields() -> None:
    draft = _extract_task_drafts(json.dumps([{"title": "A"}]))[0]
    assert draft["description"] == ""
    assert draft["priority"] == "medium"


def test_extract_drafts_skips_items_without_a_title() -> None:
    content = json.dumps(
        [
            {"description": "no title here"},
            {"title": "   ", "priority": "low"},
            {"title": "Real task"},
        ]
    )
    assert [d["title"] for d in _extract_task_drafts(content)] == ["Real task"]


def test_extract_drafts_caps_at_max() -> None:
    content = json.dumps([{"title": f"Task {i}"} for i in range(40)])
    assert len(_extract_task_drafts(content)) == MAX_TASK_DRAFTS


def test_extract_drafts_rejects_unparseable() -> None:
    with pytest.raises(AIInvalidResponse):
        _extract_task_drafts("the model declined to answer")


def test_extract_drafts_rejects_empty_list() -> None:
    with pytest.raises(AIInvalidResponse):
        _extract_task_drafts("[]")


def test_extract_drafts_rejects_list_without_usable_items() -> None:
    with pytest.raises(AIInvalidResponse):
        _extract_task_drafts(json.dumps(["a string", 42, {"no": "title"}]))


# --- POST /projects/:id/ai/tasks (endpoint, AI mocked) ----------------------


def request_drafts(
    client: TestClient,
    headers: dict[str, str],
    project_id: str,
    text: str = "Build a login page and wire up the API",
):
    return client.post(
        f"/projects/{project_id}/ai/tasks",
        json={"text": text},
        headers=headers,
    )


def test_drafts_endpoint_returns_drafts(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)
    monkeypatch.setattr(
        ai,
        "generate_tasks_from_text",
        lambda text: [
            {"title": "Build login form", "description": "d", "priority": "high"}
        ],
    )

    response = request_drafts(client, admin.headers, project_id)

    assert response.status_code == 200
    assert response.json() == {
        "drafts": [
            {"title": "Build login form", "description": "d", "priority": "high"}
        ]
    }


def test_drafts_endpoint_passes_text_to_ai(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)
    captured: dict[str, str] = {}

    def fake(text: str) -> list[dict[str, str]]:
        captured["text"] = text
        return [{"title": "T", "description": "", "priority": "medium"}]

    monkeypatch.setattr(ai, "generate_tasks_from_text", fake)

    request_drafts(client, admin.headers, project_id, text="Plan the team offsite")

    assert captured["text"] == "Plan the team offsite"


def test_drafts_endpoint_allows_member(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin = register(client, "admin@example.com")
    member = register(client, "member@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, member.email)
    monkeypatch.setattr(
        ai,
        "generate_tasks_from_text",
        lambda text: [{"title": "T", "description": "", "priority": "low"}],
    )

    response = request_drafts(client, member.headers, project_id)

    assert response.status_code == 200


def test_drafts_endpoint_forbids_viewer(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    viewer = register(client, "viewer@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, viewer.email, role="viewer")

    response = request_drafts(client, viewer.headers, project_id)

    assert response.status_code == 403


def test_drafts_endpoint_blocks_non_member(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    outsider = register(client, "outsider@example.com")
    project_id = create_project(client, admin.headers)

    response = request_drafts(client, outsider.headers, project_id)

    assert response.status_code == 403


def test_drafts_endpoint_missing_project_returns_404(client: TestClient) -> None:
    admin = register(client, "admin@example.com")

    response = request_drafts(client, admin.headers, str(uuid.uuid4()))

    assert response.status_code == 404


def test_drafts_endpoint_requires_authentication(client: TestClient) -> None:
    response = client.post(
        f"/projects/{uuid.uuid4()}/ai/tasks", json={"text": "x"}
    )
    assert response.status_code == 401


def test_drafts_endpoint_rejects_blank_text(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)

    response = request_drafts(client, admin.headers, project_id, text="")

    assert response.status_code == 422


def test_drafts_endpoint_does_not_persist(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)
    monkeypatch.setattr(
        ai,
        "generate_tasks_from_text",
        lambda text: [
            {"title": "Should not be saved", "description": "", "priority": "low"}
        ],
    )

    request_drafts(client, admin.headers, project_id)

    listing = client.get(f"/projects/{project_id}/tasks", headers=admin.headers)
    assert listing.json()["total"] == 0


def test_drafts_endpoint_not_configured_returns_503(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)

    def boom(text: str) -> list[dict[str, str]]:
        raise ai.AINotConfigured("AI task drafting is not configured.")

    monkeypatch.setattr(ai, "generate_tasks_from_text", boom)

    response = request_drafts(client, admin.headers, project_id)

    assert response.status_code == 503


def test_drafts_endpoint_invalid_response_returns_422(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)

    def boom(text: str) -> list[dict[str, str]]:
        raise ai.AIInvalidResponse("The AI did not suggest any tasks.")

    monkeypatch.setattr(ai, "generate_tasks_from_text", boom)

    response = request_drafts(client, admin.headers, project_id)

    assert response.status_code == 422


def test_drafts_endpoint_service_error_returns_502(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)

    def boom(text: str) -> list[dict[str, str]]:
        raise ai.AIServiceError("Could not reach the AI service.")

    monkeypatch.setattr(ai, "generate_tasks_from_text", boom)

    response = request_drafts(client, admin.headers, project_id)

    assert response.status_code == 502
