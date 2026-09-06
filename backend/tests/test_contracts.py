"""Contract conformance tests verifying OpenAPI route responses and error formats."""
import pytest


@pytest.mark.asyncio
async def test_health_contract(client):
    res = await client.get("/api/v1/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_capabilities_contract(client, auth_headers_user1):
    res = await client.get("/api/v1/me/capabilities", headers=auth_headers_user1)
    assert res.status_code == 200
    data = res.json()
    assert data["contractVersion"] == "1.0"
    caps = data["capabilities"]
    expected_keys = [
        "textVerification",
        "urlVerification",
        "socialVerification",
        "imageProvenance",
        "youtubeVideo",
        "shortVideoUpload",
        "c2paInspection",
        "maps",
        "appCheckEnforced",
        "maintenanceMode",
    ]
    for key in expected_keys:
        assert key in caps
        assert isinstance(caps[key], bool)


@pytest.mark.asyncio
async def test_error_response_contract_unauthorized(client):
    res = await client.get("/api/v1/me/capabilities")
    assert res.status_code == 401
    data = res.json()
    assert data["contractVersion"] == "1.0"
    assert "error" in data
    err = data["error"]
    assert err["code"] == "AUTH_REQUIRED"
    assert "requestId" in err
    assert err["retryable"] is False

