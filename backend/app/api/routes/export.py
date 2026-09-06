"""User data export route responding with 202 Accepted."""
import asyncio
from datetime import datetime, timezone
import uuid
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse

from app.auth.firebase import UserPrincipal, get_current_user
from app.models.schemas import OperationAccepted
from app.repositories.firestore import firestore_repo
from app.services.export.export_service import export_service

router = APIRouter(tags=["User"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.post("/me/export", response_model=OperationAccepted, status_code=status.HTTP_202_ACCEPTED)
async def create_user_export(user: UserPrincipal = Depends(get_current_user)):
    export_id = f"exp_{uuid.uuid4().hex[:20]}"
    operation_id = export_id

    op_record = {
        "contractVersion": "1.0",
        "operationId": operation_id,
        "ownerUid": user.uid,
        "inputType": "export",
        "state": "processing",
        "stage": "saving_report",
        "progressPercent": 50,
        "completedStages": ["validating_input"],
        "createdAt": _now_iso(),
        "updatedAt": _now_iso(),
    }
    await firestore_repo.create_operation(op_record)

    # Run export generation in background
    async def _run_export():
        try:
            path = await export_service.generate_user_export(user.uid, export_id)
            await firestore_repo.update_operation(
                operation_id,
                {
                    "state": "complete",
                    "stage": "complete",
                    "progressPercent": 100,
                    "completedStages": ["validating_input", "saving_report", "complete"],
                    "resultUrl": f"/api/v1/storage/{path}",
                    "message": "Export completed successfully.",
                },
            )
        except Exception as e:
            await firestore_repo.update_operation(
                operation_id,
                {
                    "state": "failed",
                    "progressPercent": 100,
                    "message": f"Export failed: {e}",
                },
            )

    asyncio.create_task(_run_export())

    status_url = f"/api/v1/operations/{operation_id}"
    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content={
            "contractVersion": "1.0",
            "operationId": operation_id,
            "status": "queued",
            "statusUrl": status_url,
        },
        headers={"Location": status_url, "Retry-After": "2"},
    )

