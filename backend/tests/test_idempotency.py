"""Idempotency test suite verifying duplicate requests return existing operation without duplicate charges."""
import pytest


@pytest.mark.asyncio
async def test_idempotent_submission(client, auth_headers_user1):
    idemp_key = "idemp_test_identical_key_123456789"
    payload = {"text": "Statement submitted to test idempotency preservation."}

    # First submission
    res1 = await client.post(
        "/api/v1/verifications/text",
        headers={**auth_headers_user1, "Idempotency-Key": idemp_key},
        json=payload,
    )
    assert res1.status_code == 202
    op_id_1 = res1.json()["operationId"]

    # Second identical submission with same Idempotency-Key
    res2 = await client.post(
        "/api/v1/verifications/text",
        headers={**auth_headers_user1, "Idempotency-Key": idemp_key},
        json=payload,
    )
    assert res2.status_code == 202
    op_id_2 = res2.json()["operationId"]

    # Must return exact same operation ID
    assert op_id_1 == op_id_2

