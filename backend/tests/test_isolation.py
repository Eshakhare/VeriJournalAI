"""Multi-user cross-tenant isolation tests verifying zero data leakage between users."""
import pytest
from app.repositories.firestore import firestore_repo


@pytest.mark.asyncio
async def test_cross_user_operation_isolation(client, auth_headers_user1, auth_headers_user2):
    # User 1 submits a verification
    res1 = await client.post(
        "/api/v1/verifications/text",
        headers={**auth_headers_user1, "Idempotency-Key": "idemp_alice_key_1234567890"},
        json={"text": "Global climate summit announced new carbon reduction targets."},
    )
    assert res1.status_code == 202
    op_id = res1.json()["operationId"]

    # User 1 can access their own operation
    res_owner = await client.get(f"/api/v1/operations/{op_id}", headers=auth_headers_user1)
    assert res_owner.status_code == 200
    assert res_owner.json()["operationId"] == op_id

    # User 2 attempts to query User 1's operation -> MUST receive 404 (existence not leaked)
    res_other = await client.get(f"/api/v1/operations/{op_id}", headers=auth_headers_user2)
    assert res_other.status_code == 404
    assert res_other.json()["error"]["code"] == "OPERATION_NOT_FOUND"

    # User 2 attempts to cancel User 1's operation -> MUST receive 404
    res_cancel = await client.post(f"/api/v1/operations/{op_id}/cancel", headers=auth_headers_user2)
    assert res_cancel.status_code == 404


@pytest.mark.asyncio
async def test_cross_user_journal_entry_isolation(client, auth_headers_user1, auth_headers_user2):
    # Pre-populate journal entry for User 1 (Alice)
    entry_id = "ent_alice_entry_12345678"
    await firestore_repo.create_journal_entry(
        uid="user_alice",
        entry_data={
            "entryId": entry_id,
            "inputType": "text",
            "title": "Alice's Private Journal Entry",
            "status": "complete",
            "evidenceStatus": "supported",
            "evidenceConfidence": "high",
            "createdAt": "2026-03-01T12:00:00Z",
            "updatedAt": "2026-03-01T12:00:00Z",
            "claims": [],
            "evidence": [],
            "timeline": [],
            "media": [],
            "reflection": None,
            "limitations": [],
        },
    )

    # Alice can read her entry
    res_alice = await client.get(f"/api/v1/journal/entries/{entry_id}", headers=auth_headers_user1)
    assert res_alice.status_code == 200
    assert res_alice.json()["title"] == "Alice's Private Journal Entry"

    # Bob attempts to read Alice's entry -> MUST receive 404
    res_bob_get = await client.get(f"/api/v1/journal/entries/{entry_id}", headers=auth_headers_user2)
    assert res_bob_get.status_code == 404
    assert res_bob_get.json()["error"]["code"] == "OPERATION_NOT_FOUND"

    # Bob attempts to delete Alice's entry -> MUST receive 404
    res_bob_del = await client.delete(f"/api/v1/journal/entries/{entry_id}", headers=auth_headers_user2)
    assert res_bob_del.status_code == 404

    # Bob attempts to mutate Alice's reflection -> MUST receive 404
    res_bob_put = await client.put(
        f"/api/v1/journal/entries/{entry_id}/reflection",
        headers=auth_headers_user2,
        json={"updatedConfidence": 80, "updatedReflection": "Malicious reflection"},
    )
    assert res_bob_put.status_code == 404

