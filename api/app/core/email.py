"""Pluggable transactional email.

Delivery is chosen at call time from configuration, in priority order:

1. **Resend** — used when ``RESEND_API_KEY`` is set (HTTP API, no SMTP needed).
2. **SMTP** — used when ``SMTP_HOST`` is set.
3. **Log** — the fallback: the message (including the link) is written to the
   application log. This makes the password-reset flow work out-of-the-box
   locally and on hosts without email configured (e.g. Render's free tier);
   the link is recoverable from the server logs.

Sending never raises to the caller: a delivery failure is logged and the
request still succeeds, so failures cannot be used to probe which emails are
registered.
"""

import logging
import smtplib
from email.message import EmailMessage

import httpx

from app.core.config import get_settings

logger = logging.getLogger("app.email")

_RESEND_ENDPOINT = "https://api.resend.com/emails"
_REQUEST_TIMEOUT = 10.0


def send_email(to: str, subject: str, body: str) -> None:
    """Send a plain-text email via the configured transport (best effort)."""
    settings = get_settings()
    try:
        if settings.resend_api_key:
            _send_via_resend(settings.email_from, to, subject, body)
        elif settings.smtp_host:
            _send_via_smtp(settings.email_from, to, subject, body)
        else:
            logger.info("[email:log] to=%s subject=%r\n%s", to, subject, body)
    except Exception:  # noqa: BLE001 — delivery must never break the request
        logger.exception("Failed to send email to %s", to)


def send_password_reset_email(to: str, reset_url: str) -> None:
    """Send the password-reset link to ``to``."""
    subject = "Reset your MiniFlow password"
    body = (
        "We received a request to reset your MiniFlow password.\n\n"
        f"Use this link to choose a new one (valid for 15 minutes):\n{reset_url}\n\n"
        "If you didn't request this, you can safely ignore this email — "
        "your password won't change."
    )
    send_email(to, subject, body)


def _send_via_resend(sender: str, to: str, subject: str, body: str) -> None:
    settings = get_settings()
    response = httpx.post(
        _RESEND_ENDPOINT,
        headers={"Authorization": f"Bearer {settings.resend_api_key}"},
        json={"from": sender, "to": [to], "subject": subject, "text": body},
        timeout=_REQUEST_TIMEOUT,
    )
    response.raise_for_status()


def _send_via_smtp(sender: str, to: str, subject: str, body: str) -> None:
    settings = get_settings()
    message = EmailMessage()
    message["From"] = sender
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=_REQUEST_TIMEOUT) as smtp:
        smtp.starttls()
        if settings.smtp_user:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(message)
