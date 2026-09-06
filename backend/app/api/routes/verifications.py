"""Verification submission endpoints responding with 202 Accepted and queuing Cloud Tasks."""
from datetime import datetime, timezone
import hashlib
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, File, Form, Header, Response, UploadFile, status
from fastapi.responses import JSONResponse

from app.auth.firebase import UserPrincipal, get_current_user
from app.core.config import settings
from app.core.errors import VeriJournalException
from app.core.logging import logger
from app.models.schemas import (
    MediaSummary,
    OperationAccepted,
    OperationStage,
    OperationState,
    SocialVerificationRequest,
    TextVerificationRequest,
    UrlVerificationRequest,
)
from app.repositories.firestore import firestore_repo
from app.repositories.storage import storage_repo
from app.services.abuse.rate_limiter import rate_limiter
from app.services.media.image_processor import verify_image_bytes
from app.services.tasks.publisher import tasks_publisher

router = APIRouter(prefix="/verifications", tags=["Verifications"])


def _generate_operation_id() -> str:
    # 24 char alphanumeric identifier satisfying ^[A-Za-z0-9_-]{16,128}$
    return f"op_{uuid.uuid4().hex[:20]}"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _accepted_response(operation_id: str) -> JSONResponse:
    status_url = f"/api/v1/operations/{operation_id}"
    payload = {
        "contractVersion": "1.0",
        "operationId": operation_id,
        "status": "queued",
        "statusUrl": status_url,
    }
    headers = {
        "Location": status_url,
        "Retry-After": "2",
    }
    return JSONResponse(status_code=status.HTTP_202_ACCEPTED, content=payload, headers=headers)


@router.post("/text", response_model=OperationAccepted, status_code=status.HTTP_202_ACCEPTED)
async def submit_text_verification(
    request_data: TextVerificationRequest,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    user: UserPrincipal = Depends(get_current_user),
):
    rate_limiter.check_submission_limit(user.uid)
    fingerprint = hashlib.sha256(request_data.text.encode("utf-8")).hexdigest()
    proposed_op_id = _generate_operation_id()

    is_new, op_id = await firestore_repo.get_or_create_idempotency_record(
        uid=user.uid,
        route="/verifications/text",
        fingerprint=fingerprint,
        idempotency_key=idempotency_key,
        operation_id=proposed_op_id,
    )

    if is_new:
        op_record = {
            "contractVersion": "1.0",
            "operationId": op_id,
            "entryId": op_id,
            "ownerUid": user.uid,
            "inputType": "text",
            "state": OperationState.queued.value,
            "stage": OperationStage.validating_input.value,
            "progressPercent": 0,
            "completedStages": [],
            "rawInput": {
                "text": request_data.text,
                "initialReflection": request_data.initialReflection,
                "initialConfidence": request_data.initialConfidence,
            },
            "cancelRequested": False,
            "createdAt": _now_iso(),
            "updatedAt": _now_iso(),
        }
        await firestore_repo.create_operation(op_record)
        await tasks_publisher.enqueue_operation_task(op_id)

    return _accepted_response(op_id)


@router.post("/url", response_model=OperationAccepted, status_code=status.HTTP_202_ACCEPTED)
async def submit_url_verification(
    request_data: UrlVerificationRequest,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    user: UserPrincipal = Depends(get_current_user),
):
    rate_limiter.check_submission_limit(user.uid)
    fingerprint = hashlib.sha256(request_data.url.encode("utf-8")).hexdigest()
    proposed_op_id = _generate_operation_id()

    is_new, op_id = await firestore_repo.get_or_create_idempotency_record(
        uid=user.uid,
        route="/verifications/url",
        fingerprint=fingerprint,
        idempotency_key=idempotency_key,
        operation_id=proposed_op_id,
    )

    if is_new:
        op_record = {
            "contractVersion": "1.0",
            "operationId": op_id,
            "entryId": op_id,
            "ownerUid": user.uid,
            "inputType": "article_url",
            "state": OperationState.queued.value,
            "stage": OperationStage.validating_input.value,
            "progressPercent": 0,
            "completedStages": [],
            "rawInput": {
                "url": request_data.url,
                "initialReflection": request_data.initialReflection,
                "initialConfidence": request_data.initialConfidence,
            },
            "cancelRequested": False,
            "createdAt": _now_iso(),
            "updatedAt": _now_iso(),
        }
        await firestore_repo.create_operation(op_record)
        await tasks_publisher.enqueue_operation_task(op_id)

    return _accepted_response(op_id)


@router.post("/social", response_model=OperationAccepted, status_code=status.HTTP_202_ACCEPTED)
async def submit_social_verification(
    request_data: SocialVerificationRequest,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    user: UserPrincipal = Depends(get_current_user),
):
    rate_limiter.check_submission_limit(user.uid)
    raw_str = f"{request_data.url}:{request_data.accompanyingClaim or ''}"
    fingerprint = hashlib.sha256(raw_str.encode("utf-8")).hexdigest()
    proposed_op_id = _generate_operation_id()

    is_new, op_id = await firestore_repo.get_or_create_idempotency_record(
        uid=user.uid,
        route="/verifications/social",
        fingerprint=fingerprint,
        idempotency_key=idempotency_key,
        operation_id=proposed_op_id,
    )

    if is_new:
        op_record = {
            "contractVersion": "1.0",
            "operationId": op_id,
            "entryId": op_id,
            "ownerUid": user.uid,
            "inputType": "social_post",
            "state": OperationState.queued.value,
            "stage": OperationStage.validating_input.value,
            "progressPercent": 0,
            "completedStages": [],
            "rawInput": {
                "url": request_data.url,
                "accompanyingClaim": request_data.accompanyingClaim,
                "initialReflection": request_data.initialReflection,
                "initialConfidence": request_data.initialConfidence,
            },
            "cancelRequested": False,
            "createdAt": _now_iso(),
            "updatedAt": _now_iso(),
        }
        await firestore_repo.create_operation(op_record)
        await tasks_publisher.enqueue_operation_task(op_id)

    return _accepted_response(op_id)


@router.post("/media", response_model=OperationAccepted, status_code=status.HTTP_202_ACCEPTED)
async def submit_media_verification(
    file: UploadFile = File(...),
    accompanyingClaim: Optional[str] = Form(None),
    initialReflection: Optional[str] = Form(None),
    initialConfidence: Optional[int] = Form(None),
    saveExactGps: bool = Form(False),
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    user: UserPrincipal = Depends(get_current_user),
):
    rate_limiter.check_submission_limit(user.uid)
    file_bytes = await file.read()
    if not file_bytes:
        raise VeriJournalException(code="INVALID_INPUT", message="Uploaded media file is empty.")

    detected_mime = verify_image_bytes(file_bytes)
    fingerprint = hashlib.sha256(file_bytes).hexdigest()
    proposed_op_id = _generate_operation_id()

    is_new, op_id = await firestore_repo.get_or_create_idempotency_record(
        uid=user.uid,
        route="/verifications/media",
        fingerprint=fingerprint,
        idempotency_key=idempotency_key,
        operation_id=proposed_op_id,
    )

    if is_new:
        media_id = f"med_{uuid.uuid4().hex[:16]}"
        # Store in private bucket uploads/{uid}/{operationId}/{mediaId}/{serverGeneratedName}
        storage_path = await storage_repo.upload_media(
            uid=user.uid,
            operation_id=op_id,
            media_id=media_id,
            file_bytes=file_bytes,
            content_type=detected_mime,
            filename=file.filename,
        )

        op_record = {
            "contractVersion": "1.0",
            "operationId": op_id,
            "entryId": op_id,
            "ownerUid": user.uid,
            "inputType": "image",
            "state": OperationState.queued.value,
            "stage": OperationStage.validating_input.value,
            "progressPercent": 0,
            "completedStages": [],
            "rawInput": {
                "mediaId": media_id,
                "storagePath": storage_path,
                "filename": file.filename,
                "accompanyingClaim": accompanyingClaim,
                "initialReflection": initialReflection,
                "initialConfidence": initialConfidence,
                "saveExactGps": saveExactGps,
            },
            "cancelRequested": False,
            "createdAt": _now_iso(),
            "updatedAt": _now_iso(),
        }
        await firestore_repo.create_operation(op_record)
        await tasks_publisher.enqueue_operation_task(op_id)

    return _accepted_response(op_id)

