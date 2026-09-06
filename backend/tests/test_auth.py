"""Authentication and authorization test suite."""
import pytest


@pytest.mark.asyncio
async def test_auth_missing_header(client):
    res = await client.get("/api/v1/journal/entries")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "AUTH_REQUIRED"


@pytest.mark.asyncio
async def test_auth_invalid_format(client):
    res = await client.get("/api/v1/journal/entries", headers={"Authorization": "InvalidScheme token"})
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "AUTH_INVALID"


@pytest.mark.asyncio
async def test_auth_valid_user_principal(client, auth_headers_user1):
    res = await client.get("/api/v1/journal/entries", headers=auth_headers_user1)
    assert res.status_code == 200
    assert res.json()["contractVersion"] == "1.0"


@pytest.mark.asyncio
async def test_worker_auth_required(client):
    res = await client.post("/api/v1/internal/tasks/worker", json={"operationId": "op_test123"})
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "AUTH_REQUIRED"


@pytest.mark.asyncio
async def test_worker_auth_success(client, worker_auth_headers):
    res = await client.post(
        "/api/v1/internal/tasks/worker",
        headers=worker_auth_headers,
        json={"operationId": "op_test123", "contractVersion": "1.0"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

