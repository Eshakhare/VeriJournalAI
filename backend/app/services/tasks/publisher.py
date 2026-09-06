"""Cloud Tasks publisher supporting Google Cloud Tasks and local asynchronous execution."""
import asyncio
import json
from typing import Optional

from app.core.config import settings
from app.core.logging import logger

_tasks_client = None
try:
    from google.cloud import tasks_v2
    if not settings.dev_mode and not settings.use_local_tasks_adapter:
        _tasks_client = tasks_v2.CloudTasksClient()
except Exception as e:
    logger.info(f"Google Cloud Tasks client initialization skipped: {e}")


class CloudTasksPublisher:
    def __init__(self, client=None):
        self.client = client or _tasks_client

    async def enqueue_operation_task(
        self,
        operation_id: str,
    ) -> str:
        """Publishes task payload with only operationId and contractVersion."""
        payload = {
            "contractVersion": "1.0",
            "operationId": operation_id,
        }

        # Local development / test adapter
        if settings.use_local_tasks_adapter or not self.client:
            from app.services.tasks.worker import verification_worker
            # Trigger asynchronous background run without blocking HTTP 202 response
            asyncio.create_task(verification_worker.process_operation(operation_id))
            logger.info(f"Dispatched local task execution for operation {operation_id}")
            return f"local_task_{operation_id}"

        # Production Cloud Tasks with OIDC Token
        parent = self.client.queue_path(
            settings.google_cloud_project,
            settings.cloud_tasks_location,
            settings.cloud_tasks_queue,
        )

        task = {
            "http_request": {
                "http_method": tasks_v2.HttpMethod.POST,
                "url": settings.task_worker_url,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps(payload).encode("utf-8"),
                "oidc_token": {
                    "service_account_email": settings.task_invoker_service_account,
                    "audience": settings.task_worker_audience,
                },
            }
        }

        response = self.client.create_task(request={"parent": parent, "task": task})
        logger.info(f"Created Cloud Task: {response.name} for operation {operation_id}")
        return response.name


tasks_publisher = CloudTasksPublisher()

