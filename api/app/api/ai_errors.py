"""Translate the typed AI service exceptions into clean HTTP responses.

Every AI endpoint (subtask generation, project summaries, task drafting)
maps the same three failure modes from :mod:`app.services.ai` onto the same
HTTP status codes. This context manager keeps that mapping in one place.
"""

from collections.abc import Iterator
from contextlib import contextmanager

from fastapi import HTTPException, status

from app.services import ai


@contextmanager
def ai_errors() -> Iterator[None]:
    """Re-raise AI service failures as HTTP errors.

    * :class:`ai.AINotConfigured`   -> 503 Service Unavailable
    * :class:`ai.AIInvalidResponse` -> 422 Unprocessable Content
    * :class:`ai.AIServiceError`    -> 502 Bad Gateway
    """
    try:
        yield
    except ai.AINotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    except ai.AIInvalidResponse as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        ) from exc
    except ai.AIServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc
