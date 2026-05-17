import uuid
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.services import ai
from app.services.ai import _build_summary_prompt
from tests.test_tasks import add_member, create_project, create_task, register


def _task(
    title: str,
    status: str,
    priority: str = "medium",
    due_date: object | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        title=title, status=status, priority=priority, due_date=due_date
    )


# --- _build_summary_prompt (unit) -------------------------------------------


def test_summary_prompt_lists_every_task() -> None:
    tasks = [
        _task("Design schema", "done"),
        _task("Build API", "in_progress"),
        _task("Write docs", "todo"),
    ]
    prompt = _build_summary_prompt("Roadmap", tasks)
    assert "Roadmap" in prompt
    assert "Design schema" in prompt
    assert "Build API" in prompt
    assert "Write docs" in prompt


def test_summary_prompt_groups_tasks_by_status_with_counts() -> None:
    tasks = [_task("A", "todo"), _task("B", "todo")]
    prompt = _build_summary_prompt("P", tasks)
    assert "To do (2)" in prompt
    assert "In progress (0)" in prompt
    assert "Done (0)" in prompt


def test_summary_prompt_marks_empty_groups() -> None:
    prompt = _build_summary_prompt("Empty project", [])
    assert "(none)" in prompt


def test_summary_prompt_includes_priority_and_due_date() -> None:
    tasks = [_task("Ship it", "todo", priority="high", due_date="2026-06-01")]
    prompt = _build_summary_prompt("P", tasks)
    assert "high" in prompt
    assert "2026-06-01" in prompt


# --- POST /projects/:id/ai/summary (endpoint, AI mocked) --------------------


def test_summary_endpoint_returns_summary(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)
    create_task(client, admin.headers, project_id)
    monkeypatch.setattr(
        ai, "generate_project_summary", lambda name, tasks: "All on track."
    )

    response = client.post(
        f"/projects/{project_id}/ai/summary", headers=admin.headers
    )

    assert response.status_code == 200
    assert response.json() == {"summary": "All on track."}


def test_summary_endpoint_passes_project_name_and_tasks_to_ai(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)
    create_task(client, admin.headers, project_id, title="A distinctive task")
    captured: dict[str, object] = {}

    def fake(name: str, tasks: object) -> str:
        captured["name"] = name
        captured["titles"] = [t.title for t in tasks]  # type: ignore[attr-defined]
        return "summary text"

    monkeypatch.setattr(ai, "generate_project_summary", fake)

    client.post(f"/projects/{project_id}/ai/summary", headers=admin.headers)

    assert captured["name"] == "Roadmap"
    assert "A distinctive task" in captured["titles"]  # type: ignore[operator]


def test_summary_endpoint_allows_viewer(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin = register(client, "admin@example.com")
    viewer = register(client, "viewer@example.com")
    project_id = create_project(client, admin.headers)
    add_member(client, project_id, admin.headers, viewer.email, role="viewer")
    monkeypatch.setattr(ai, "generate_project_summary", lambda name, tasks: "ok")

    response = client.post(
        f"/projects/{project_id}/ai/summary", headers=viewer.headers
    )

    assert response.status_code == 200


def test_summary_endpoint_blocks_non_member(client: TestClient) -> None:
    admin = register(client, "admin@example.com")
    outsider = register(client, "outsider@example.com")
    project_id = create_project(client, admin.headers)

    response = client.post(
        f"/projects/{project_id}/ai/summary", headers=outsider.headers
    )

    assert response.status_code == 403


def test_summary_endpoint_missing_project_returns_404(client: TestClient) -> None:
    admin = register(client, "admin@example.com")

    response = client.post(
        f"/projects/{uuid.uuid4()}/ai/summary", headers=admin.headers
    )

    assert response.status_code == 404


def test_summary_endpoint_requires_authentication(client: TestClient) -> None:
    response = client.post(f"/projects/{uuid.uuid4()}/ai/summary")
    assert response.status_code == 401


def test_summary_endpoint_not_configured_returns_503(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)

    def boom(name: str, tasks: object) -> str:
        raise ai.AINotConfigured("AI project summaries are not configured.")

    monkeypatch.setattr(ai, "generate_project_summary", boom)

    response = client.post(
        f"/projects/{project_id}/ai/summary", headers=admin.headers
    )

    assert response.status_code == 503


def test_summary_endpoint_invalid_response_returns_422(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)

    def boom(name: str, tasks: object) -> str:
        raise ai.AIInvalidResponse("The AI returned an empty summary.")

    monkeypatch.setattr(ai, "generate_project_summary", boom)

    response = client.post(
        f"/projects/{project_id}/ai/summary", headers=admin.headers
    )

    assert response.status_code == 422


def test_summary_endpoint_service_error_returns_502(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin = register(client, "admin@example.com")
    project_id = create_project(client, admin.headers)

    def boom(name: str, tasks: object) -> str:
        raise ai.AIServiceError("Could not reach the AI service.")

    monkeypatch.setattr(ai, "generate_project_summary", boom)

    response = client.post(
        f"/projects/{project_id}/ai/summary", headers=admin.headers
    )

    assert response.status_code == 502
