"""End-to-end verification pipeline test."""
import pytest
from app.services.tasks.worker import verification_worker


@pytest.mark.asyncio
async def test_full_text_verification_pipeline(client, auth_headers_user1):
    # 1. Submit verification
    res = await client.post(
        "/api/v1/verifications/text",
        headers={**auth_headers_user1, "Idempotency-Key": "idemp_pipeline_test_key_001"},
        json={
            "text": "The World Health Organization confirmed new guidelines on global health standards.",
            "initialReflection": "I believe this is an authentic announcement.",
            "initialConfidence": 85,
        },
    )
    assert res.status_code == 202
    data = res.json()
    op_id = data["operationId"]

    # 2. Worker processes operation through all 9 stages
    await verification_worker.process_operation(op_id, worker_id="test_worker")

    # 3. Poll operation status
    res_status = await client.get(f"/api/v1/operations/{op_id}", headers=auth_headers_user1)
    assert res_status.status_code == 200
    status_data = res_status.json()
    assert status_data["status"] == "complete"
    assert status_data["stage"] == "complete"
    assert status_data["progressPercent"] == 100
    assert len(status_data["completedStages"]) > 0

    # 4. Fetch the verified journal entry
    res_entry = await client.get(f"/api/v1/journal/entries/{op_id}", headers=auth_headers_user1)
    assert res_entry.status_code == 200
    entry_data = res_entry.json()
    assert entry_data["contractVersion"] == "1.0"
    assert entry_data["entryId"] == op_id
    assert len(entry_data["claims"]) > 0
    assert entry_data["reflection"]["initialConfidence"] == 85

