"""Operation status polling, cancellation, and retry routes with ETag and 304 support."""
import hashlib
import json
from typing import Optional

from fastapi import APIRouter, Depends, Header, Response, status
from fastapi.responses import JSONResponse

from app.auth.firebase import UserPrincipal, get_current_user
from app.core.errors import VeriJournalException
from app.core.logging import logger
from app.models.schemas import (
    OperationAccepted,
    OperationStatus,
)
from app.repositories.firestore import firestore_repo
from app.services.abuse.rate_limiter import rate_limiter
from app.services.tasks.publisher import tasks_publisher

router = APIRouter(prefix="/operations", tags=["Operations"])


def _compute_etag(op_dict: dict) -> str:
    key_fields = f"{op_dict.get('stage')}:{op_dict.get('state')}:{op_dict.get('progressPercent')}:{op_dict.get('updatedAt')}"
    return f'"{hashlib.sha256(key_fields.encode("utf-8")).hexdigest()[:16]}"'


@router.get("/{operationId}", response_model=OperationStatus)
async def get_operation(
    operationId: str,
    if_none_match: Optional[str] = Header(None, alias="If-None-Match"),
    user: UserPrincipal = Depends(get_current_user),
):
    rate_limiter.check_polling_limit(user.uid)
    op = await firestore_repo.get_operation(operationId, owner_uid=user.uid)
    if not op:
        raise VeriJournalException(code="OPERATION_NOT_FOUND", message="Operation not found.")

    etag = _compute_etag(op)
    if if_none_match and if_none_match.strip() == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers={"ETag": etag, "Retry-After": "2"})

    response_data = {
        "contractVersion": "1.0",
        "operationId": op["operationId"],
        "status": op["state"],
        "stage": op["stage"],
        "progressPercent": op["progressPercent"],
        "message": op.get("message"),
        "completedStages": op.get("completedStages", []),
        "partialResult": op.get("partialResult"),
        "resultUrl": op.get("resultUrl"),
        "error": op.get("error"),
        "updatedAt": op["updatedAt"],
    }

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=response_data,
        headers={"ETag": etag, "Retry-After": "2"},
    )


@router.post("/{operationId}/cancel", response_model=OperationStatus)
async def cancel_operation(
    operationId: str,
    user: UserPrincipal = Depends(get_current_user),
):
    op = await firestore_repo.get_operation(operationId, owner_uid=user.uid)
    if not op:
        raise VeriJournalException(code="OPERATION_NOT_FOUND", message="Operation not found.")

    await firestore_repo.update_operation(operationId, {"cancelRequested": True})
    updated_op = await firestore_repo.get_operation(operationId, owner_uid=user.uid)

    return OperationStatus(
        contractVersion="1.0",
        operationId=updated_op["operationId"],
        status=updated_op["state"],
        stage=updated_op["stage"],
        progressPercent=updated_op["progressPercent"],
        message=updated_op.get("message"),
        completedStages=updated_op.get("completedStages", []),
        partialResult=updated_op.get("partialResult"),
        resultUrl=updated_op.get("resultUrl"),
        error=updated_op.get("error"),
        updatedAt=updated_op["updatedAt"],
    )


@router.post("/{operationId}/retry", response_model=OperationAccepted, status_code=status.HTTP_202_ACCEPTED)
async def retry_operation(
    operationId: str,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    user: UserPrincipal = Depends(get_current_user),
):
    rate_limiter.check_submission_limit(user.uid)
    op = await firestore_repo.get_operation(operationId, owner_uid=user.uid)
    if not op:
        raise VeriJournalException(code="OPERATION_NOT_FOUND", message="Operation not found.")

    if op["state"] not in ("failed", "cancelled"):
        raise VeriJournalException(code="OPERATION_NOT_RETRYABLE", message="Only failed or cancelled operations can be retried.")

    # Reset operation for retry
    await firestore_repo.update_operation(
        operationId,
        {
            "state": "queued",
            "stage": "validating_input",
            "progressPercent": 0,
            "message": "Operation queued for retry.",
            "completedStages": [],
            "cancelRequested": False,
            "error": None,
        },
    )
    await tasks_publisher.enqueue_operation_task(operationId)

    status_url = f"/api/v1/operations/{operationId}"
    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content={
            "contractVersion": "1.0",
            "operationId": operationId,
            "status": "queued",
            "statusUrl": status_url,
        },
        headers={"Location": status_url, "Retry-After": "2"},
    )

