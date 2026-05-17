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

import httpx

from app.core.config import get_settings

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
    """The LLM responded, but not with a usable list of subtask titles."""


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


def generate_subtask_titles(title: str, description: str | None) -> list[str]:
    """Ask the configured LLM to break a task into subtask titles.

    Returns a list of at most :data:`MAX_SUBTASKS` non-empty title strings.
    """
    settings = get_settings()
    if not settings.llm_api_key:
        raise AINotConfigured("AI subtask generation is not configured on this server.")

    payload = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_prompt(title, description)},
        ],
        "temperature": 0.4,
        "max_tokens": 600,
    }
    headers = {
        "Authorization": f"Bearer {settings.llm_api_key}",
        "Content-Type": "application/json",
        # Optional OpenRouter attribution headers.
        "HTTP-Referer": "https://miniflow.app",
        "X-Title": "MiniFlow",
    }

    try:
        response = httpx.post(
            f"{settings.llm_base_url.rstrip('/')}/chat/completions",
            json=payload,
            headers=headers,
            timeout=_REQUEST_TIMEOUT,
        )
    except httpx.HTTPError as exc:
        raise AIServiceError("Could not reach the AI service. Please try again.") from exc

    if response.status_code != 200:
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

    return _extract_titles(content)
