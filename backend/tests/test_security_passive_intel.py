from __future__ import annotations

import httpx
import pytest

from backend.app.security.passive_intel import PassiveIntelError, virustotal_enrich


@pytest.mark.asyncio
async def test_virustotal_passive_enrichment_normalizes_response() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers.get("x-apikey") == "test-key"
        assert request.url.path == "/api/v3/ip_addresses/8.8.8.8"
        return httpx.Response(
            200,
            json={
                "data": {
                    "id": "8.8.8.8",
                    "attributes": {
                        "reputation": 12,
                        "tags": ["public-dns"],
                        "last_analysis_stats": {
                            "malicious": 1,
                            "suspicious": 2,
                            "harmless": 70,
                            "undetected": 5,
                        },
                    },
                }
            },
        )

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(base_url="https://www.virustotal.com", transport=transport) as client:
        result = await virustotal_enrich("ip", "8.8.8.8", api_key="test-key", client=client)

    assert result.provider == "virustotal"
    assert result.indicator_type == "ip"
    assert result.malicious == 1
    assert result.suspicious == 2
    assert result.tags == ["public-dns"]


@pytest.mark.asyncio
async def test_virustotal_requires_configuration() -> None:
    with pytest.raises(PassiveIntelError, match="virustotal_not_configured"):
        await virustotal_enrich("domain", "example.com", api_key="")


@pytest.mark.asyncio
async def test_virustotal_never_turns_not_found_into_scan() -> None:
    transport = httpx.MockTransport(lambda request: httpx.Response(404, json={"error": "not found"}))
    async with httpx.AsyncClient(base_url="https://www.virustotal.com", transport=transport) as client:
        with pytest.raises(PassiveIntelError, match="indicator_not_found"):
            await virustotal_enrich("hash", "a" * 64, api_key="test-key", client=client)
