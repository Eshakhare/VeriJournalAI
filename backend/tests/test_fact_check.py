"""Fact Check Tools adapter tests verifying typed statuses."""
import pytest
from app.services.fact_check.client import FactCheckClient


@pytest.mark.asyncio
async def test_fact_check_disabled_status():
    client = FactCheckClient(api_key="fake_key", enabled=False)
    res = await client.search_claims("test claim")
    assert res.status == "disabled"
    assert len(res.items) == 0


@pytest.mark.asyncio
async def test_fact_check_unavailable_without_key():
    client = FactCheckClient(api_key=None, enabled=True)
    res = await client.search_claims("test claim")
    assert res.status == "unavailable"
    assert len(res.items) == 0

