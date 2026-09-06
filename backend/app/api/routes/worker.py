"""Internal Cloud Tasks worker endpoint protected with Google OIDC token authentication."""
from typing import Literal
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel

from app.auth.oidc import TaskWorkerPrincipal, get_task_worker_principal
from app.core.errors import VeriJournalException
from app.core.logging import logger
from app.services.tasks.worker import verification_worker

router = APIRouter(prefix="/internal/tasks", tags=["Internal Worker"])


class TaskPayload(BaseModel):
    contractVersion: Literal["1.0"] = "1.0"
    operationId: str


@router.post("/worker", status_code=status.HTTP_200_OK)
async def execute_task_worker(
    payload: TaskPayload,
    principal: TaskWorkerPrincipal = Depends(get_task_worker_principal),
):
    logger.info(
        f"Internal worker invocation received for operation {payload.operationId} from invoker {principal.service_account}"
    )
    # Execute operation synchronously within worker invocation
    await verification_worker.process_operation(
        operation_id=payload.operationId,
        worker_id=principal.service_account,
    )
    return {"status": "ok", "operationId": payload.operationId}

