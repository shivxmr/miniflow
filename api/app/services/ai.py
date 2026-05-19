"""AI subtask generation via an OpenAI-compatible LLM (OpenRouter by default).

The single public entry point is :func:`generate_subtask_titles`. It asks the
model to break a task into a short checklist and returns plain title strings.

Failure is graceful and explicit — every error path raises one of the typed
exceptions below so the router can map it to a clean HTTP status:

* :class:`AINotConfigured`  — no API key set            -> 503
* :class:`AIServiceError`   — network / upstream failure -> 502
* :class:`AIInvalidResponse`— model returned junk        -> 422
"""

import json
import logging
from collections.abc import Sequence
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

MAX_SUBTASKS = 10
_REQUEST_TIMEOUT = 30.0

_SYSTEM_PROMPT = (
    "You break a software project task into a short checklist of concrete "
    "subtasks. Reply with ONLY a JSON array of short subtask title strings — "
    f"no prose, no markdown. Return at most {MAX_SUBTASKS} items. Each title "
    "must be a brief actionable phrase (3-9 words)."
)


class AIError(Exception):
    """Base class for AI subtask-generation failures."""


class AINotConfigured(AIError):
    """No LLM API key is configured on the server."""


class AIServiceError(AIError):
    """The LLM provider could not be reached or returned an error status."""


class AIInvalidResponse(AIError):
    """The LLM responded, but not with a usable result."""


async def _chat(system_prompt: str, user_prompt: str, *, max_tokens: int) -> str:
    """Call the configured chat-completions endpoint and return the reply text.

    Centralises the OpenAI-compatible request shared by every AI feature.
    Raises the typed exceptions on missing config, transport or upstream
    failure, or a response without a usable text body.
    """
    settings = get_settings()
    if not settings.llm_api_key:
        raise AINotConfigured("AI features are not configured on this server.")

    payload = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.4,
        "max_tokens": max_tokens,
    }
    headers = {
        "Authorization": f"Bearer {settings.llm_api_key}",
        "Content-Type": "application/json",
        # Optional OpenRouter attribution headers.
        "HTTP-Referer": "https://miniflow.app",
        "X-Title": "MiniFlow",
    }

    try:
        async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
            response = await client.post(
                f"{settings.llm_base_url.rstrip('/')}/chat/completions",
                json=payload,
                headers=headers,
            )
    except httpx.HTTPError as exc:
        logger.error("AI service unreachable: %s", exc)
        raise AIServiceError("Could not reach the AI service. Please try again.") from exc

    if response.status_code != 200:
        logger.error(
            "AI service error: HTTP %s — %s", response.status_code, response.text[:200]
        )
        raise AIServiceError(
            f"The AI service returned an error (HTTP {response.status_code})."
        )

    try:
        body = response.json()
        content = body["choices"][0]["message"]["content"]
    except (json.JSONDecodeError, KeyError, IndexError, TypeError) as exc:
        raise AIInvalidResponse("The AI returned an unexpected response.") from exc

    if not isinstance(content, str):
        raise AIInvalidResponse("The AI returned an unexpected response.")
    return content


def _build_user_prompt(title: str, description: str | None) -> str:
    lines = [f"Task title: {title}"]
    if description and description.strip():
        lines.append(f"Task description: {description.strip()}")
    lines.append("List the subtasks needed to complete this task.")
    return "\n".join(lines)


def _extract_titles(content: str) -> list[str]:
    """Parse a model reply into a clean list of subtask titles.

    Tolerates markdown code fences and surrounding prose by extracting the
    first ``[...]`` JSON array. Raises :class:`AIInvalidResponse` if nothing
    usable can be recovered.
    """
    text = content.strip()
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1 or end < start:
        raise AIInvalidResponse("The AI did not return a list of subtasks.")

    try:
        parsed = json.loads(text[start : end + 1])
    except json.JSONDecodeError as exc:
        raise AIInvalidResponse("The AI returned a response that could not be read.") from exc

    if not isinstance(parsed, list):
        raise AIInvalidResponse("The AI did not return a list of subtasks.")

    titles: list[str] = []
    for item in parsed:
        if not isinstance(item, str):
            continue
        cleaned = item.strip()
        if cleaned:
            titles.append(cleaned[:220])

    if not titles:
        raise AIInvalidResponse("The AI did not suggest any subtasks.")
    return titles[:MAX_SUBTASKS]


# --- Project progress summary -----------------------------------------------

_SUMMARY_SYSTEM_PROMPT = (
    "You are a project status reporter. Given a project's tasks grouped by "
    "status, write a SHORT plain-text progress summary of 2-4 sentences — no "
    "markdown, no bullet lists, no headings. Cover what has been completed, "
    "what is currently in progress, and call out anything notable such as "
    "overdue work or likely blockers. If the project has no tasks, say so "
    "plainly in one sentence."
)


def _build_summary_prompt(project_name: str, tasks: Sequence[Any]) -> str:
    """Render a project's tasks, grouped by status, as a user prompt.

    Each ``tasks`` item must expose ``title``, ``status``, ``priority`` and
    ``due_date`` attributes — the SQLAlchemy ``Task`` model satisfies this.
    """
    groups: dict[str, list[Any]] = {"todo": [], "in_progress": [], "done": []}
    for task in tasks:
        bucket = groups.get(str(task.status))
        if bucket is not None:
            bucket.append(task)

    lines = [f'Project: "{project_name}"', ""]
    for status_key, heading in (
        ("todo", "To do"),
        ("in_progress", "In progress"),
        ("done", "Done"),
    ):
        bucket = groups[status_key]
        lines.append(f"{heading} ({len(bucket)}):")
        if not bucket:
            lines.append("  (none)")
        for task in bucket:
            due = f"due {task.due_date}" if task.due_date else "no due date"
            lines.append(f"  - {task.title} [priority: {task.priority}, {due}]")
        lines.append("")

    lines.append("Write the progress summary for this project.")
    return "\n".join(lines)


async def generate_project_summary(project_name: str, tasks: Sequence[Any]) -> str:
    """Ask the configured LLM for a short progress summary of a project.

    ``tasks`` is the project's tasks; each item must expose ``title``,
    ``status``, ``priority`` and ``due_date``. Returns a plain-text paragraph.
    """
    content = await _chat(
        _SUMMARY_SYSTEM_PROMPT,
        _build_summary_prompt(project_name, tasks),
        max_tokens=400,
    )
    summary = content.strip()
    if not summary:
        raise AIInvalidResponse("The AI returned an empty summary.")
    return summary


async def generate_subtask_titles(title: str, description: str | None) -> list[str]:
    """Ask the configured LLM to break a task into subtask titles.

    Returns a list of at most :data:`MAX_SUBTASKS` non-empty title strings.
    """
    content = await _chat(
        _SYSTEM_PROMPT,
        _build_user_prompt(title, description),
        max_tokens=600,
    )
    return _extract_titles(content)


# --- Plain-English task drafting --------------------------------------------

MAX_TASK_DRAFTS = 15
_VALID_PRIORITIES = frozenset({"low", "medium", "high"})

_TASK_DRAFT_SYSTEM_PROMPT = (
    "You turn a free-text note into a list of concrete project tasks. Reply "
    "with ONLY a JSON array of objects — no prose, no markdown. Each object "
    'has "title" (a short actionable phrase, 3-12 words), "description" (one '
    "or two sentences of detail, may be an empty string), and \"priority\" "
    '(exactly one of "low", "medium", "high"). Return at most '
    f"{MAX_TASK_DRAFTS} tasks, ordered as they should be tackled."
)


def _extract_task_drafts(content: str) -> list[dict[str, str]]:
    """Parse a model reply into a clean list of draft-task dicts.

    Tolerates markdown fences and surrounding prose by extracting the first
    ``[...]`` JSON array. Each usable item yields a dict with ``title``,
    ``description`` and a ``priority`` clamped to low/medium/high. Raises
    :class:`AIInvalidResponse` if nothing usable can be recovered.
    """
    text = content.strip()
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1 or end < start:
        raise AIInvalidResponse("The AI did not return a list of tasks.")

    try:
        parsed = json.loads(text[start : end + 1])
    except json.JSONDecodeError as exc:
        raise AIInvalidResponse("The AI returned a response that could not be read.") from exc

    if not isinstance(parsed, list):
        raise AIInvalidResponse("The AI did not return a list of tasks.")

    drafts: list[dict[str, str]] = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        title = item.get("title")
        if not isinstance(title, str) or not title.strip():
            continue
        description = item.get("description")
        description = description.strip() if isinstance(description, str) else ""
        priority = item.get("priority")
        priority = priority.strip().lower() if isinstance(priority, str) else ""
        if priority not in _VALID_PRIORITIES:
            priority = "medium"
        drafts.append(
            {
                "title": title.strip()[:220],
                "description": description[:4000],
                "priority": priority,
            }
        )

    if not drafts:
        raise AIInvalidResponse("The AI did not suggest any tasks.")
    return drafts[:MAX_TASK_DRAFTS]


async def generate_tasks_from_text(text: str) -> list[dict[str, str]]:
    """Ask the configured LLM to turn free text into draft tasks.

    Returns a list of at most :data:`MAX_TASK_DRAFTS` dicts, each with a
    ``title``, ``description`` and a ``priority`` of low/medium/high. The
    drafts are not persisted — the caller reviews them and creates real tasks.
    """
    content = await _chat(
        _TASK_DRAFT_SYSTEM_PROMPT,
        f"Notes:\n{text.strip()}",
        max_tokens=800,
    )
    return _extract_task_drafts(content)
