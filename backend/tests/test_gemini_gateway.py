"""Gemini gateway response normalization tests."""
from types import SimpleNamespace

import pytest

from app.services.ai.gemini_gateway import GeminiGateway


class _FakeModels:
    async def generate_content(self, **_kwargs):
        return SimpleNamespace(
            text='```json\n{"claims": [{"claimText": null}, {"claimText": "A checkable claim", "locations": "not-a-list"}]}\n```'
        )


class _FakeClient:
    aio = SimpleNamespace(models=_FakeModels())


@pytest.mark.asyncio
async def test_extract_claims_ignores_malformed_items_and_code_fences():
    claims = await GeminiGateway(client=_FakeClient()).extract_claims("A checkable claim.")

    assert len(claims) == 1
    assert claims[0].claimText == "A checkable claim"
    assert claims[0].locations == []