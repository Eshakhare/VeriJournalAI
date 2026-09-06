"""Google Cloud Tasks OIDC token validation dependency for internal worker endpoints."""
from dataclasses import dataclass
from typing import Optional
from fastapi import Header
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.core.config import settings
from app.core.errors import VeriJournalException
from app.core.logging import logger


@dataclass(frozen=True)
class TaskWorkerPrincipal:
    service_account: str
    audience: str


async def get_task_worker_principal(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    x_cloudtasks_taskname: Optional[str] = Header(None, alias="X-CloudTasks-TaskName"),
) -> TaskWorkerPrincipal:
    """Validates that incoming worker request carries valid Google OIDC token signed for this service."""
    if not authorization:
        raise VeriJournalException(
            code="AUTH_REQUIRED",
            message="Internal worker requires Google OIDC bearer token.",
        )

    parts = authorization.strip().split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise VeriJournalException(
            code="AUTH_INVALID",
            message="Invalid worker authorization header format.",
        )

    token = parts[1].strip()

    # Development / local testing support
    if settings.dev_mode and token.startswith("test_worker_token"):
        return TaskWorkerPrincipal(
            service_account=settings.task_invoker_service_account,
            audience=settings.task_worker_audience,
        )

    try:
        req = google_requests.Request()
        decoded = id_token.verify_oauth2_token(
            token,
            req,
            audience=settings.task_worker_audience,
        )

        issuer = decoded.get("iss")
        if issuer not in ("https://accounts.google.com", "accounts.google.com"):
            raise VeriJournalException(
                code="ACCESS_DENIED",
                message="Invalid token issuer.",
            )

        email = decoded.get("email")
        if not email or (
            settings.task_invoker_service_account
            and email != settings.task_invoker_service_account
        ):
            logger.warning(
                f"OIDC token service account mismatch: expected {settings.task_invoker_service_account}, got {email}"
            )
            raise VeriJournalException(
                code="ACCESS_DENIED",
                message="Unauthorized task invoker service account.",
            )

        return TaskWorkerPrincipal(
            service_account=email,
            audience=settings.task_worker_audience,
        )
    except VeriJournalException:
        raise
    except Exception as e:
        logger.warning(f"OIDC token verification failed: {type(e).__name__}")
        raise VeriJournalException(
            code="AUTH_INVALID",
            message="Invalid or expired Cloud Tasks OIDC token.",
        )

