from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx
import pytest

from backend.app.security.passive_intel import PassiveIntelError, virustotal_enrich


@dataclass
class _Response:
    data: list[dict[str, Any]]


class _Table:
    def __init__(self, db: "_FakeDB", name: str):
        self.db = db
        self.name = name
        self.operation = ""
        self.payload: dict[str, Any] = {}
        self.filters: dict[str, Any] = {}

    def insert(self, payload: dict[str, Any]):
        self.operation = "insert"
        self.payload = dict(payload)
        return self

    def update(self, payload: dict[str, Any]):
        self.operation = "update"
        self.payload = dict(payload)
        return self

    def eq(self, key: str, value: Any):
        self.filters[key] = value
        return self

    def execute(self):
        if self.db.fail_writes:
            raise RuntimeError("audit store unavailable")
        if self.operation == "insert":
            record = dict(self.payload)
            self.db.sequence += 1
            record.setdefault("id", f"audit-{self.db.sequence}")
            self.db.rows.setdefault(self.name, []).append(record)
            return _Response([record])
        if self.operation == "update":
            updated: list[dict[str, Any]] = []
            for record in self.db.rows.setdefault(self.name, []):
                if all(str(record.get(key)) == str(value) for key, value in self.filters.items()):
                    record.update(self.payload)
                    updated.append(dict(record))
            return _Response(updated)
        return _Response([])


class _FakeDB:
    def __init__(self, *, fail_writes: bool = False):
        self.rows: dict[str, list[dict[str, Any]]] = {}
        self.sequence = 0
        self.fail_writes = fail_writes

    def table(self, name: str) -> _Table:
        return _Table(self, name)


@pytest.mark.asyncio
async def test_virustotal_passive_enrichment_normalizes_response_and_audits() -> None:
    db = _FakeDB()

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
        result = await virustotal_enrich(
            "ip",
            "8.8.8.8",
            api_key="test-key",
            client=client,
            audit_db=db,
        )

    assert result.provider == "virustotal"
    assert result.indicator_type == "ip"
    assert result.malicious == 1
    assert result.suspicious == 2
    assert result.tags == ["public-dns"]

    actions = db.rows["hermes_security_actions"]
    events = db.rows["security_events"]
    assert len(actions) == 1
    assert actions[0]["result"] == "success"
    assert actions[0]["parameters"]["active_scan"] is False
    assert "8.8.8.8" not in str(actions[0])
    assert len(events) == 2
    assert events[0]["event_type"] == "security.tool.passive_enrichment_requested"
    assert events[1]["event_type"] == "security.tool.passive_enrichment_completed"
    assert events[1]["outcome"] == "success"


@pytest.mark.asyncio
async def test_virustotal_requires_configuration() -> None:
    with pytest.raises(PassiveIntelError, match="virustotal_not_configured"):
        await virustotal_enrich("domain", "example.com", api_key="")


@pytest.mark.asyncio
async def test_virustotal_never_turns_not_found_into_scan_and_audits_failure() -> None:
    db = _FakeDB()
    transport = httpx.MockTransport(lambda request: httpx.Response(404, json={"error": "not found"}))
    async with httpx.AsyncClient(base_url="https://www.virustotal.com", transport=transport) as client:
        with pytest.raises(PassiveIntelError, match="indicator_not_found"):
            await virustotal_enrich(
                "hash",
                "a" * 64,
                api_key="test-key",
                client=client,
                audit_db=db,
            )

    assert db.rows["hermes_security_actions"][0]["result"] == "failure"
    assert db.rows["security_events"][-1]["outcome"] == "failure"


@pytest.mark.asyncio
async def test_audit_failure_prevents_outbound_provider_request() -> None:
    db = _FakeDB(fail_writes=True)
    provider_called = False

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal provider_called
        provider_called = True
        return httpx.Response(200, json={})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(base_url="https://www.virustotal.com", transport=transport) as client:
        with pytest.raises(PassiveIntelError, match="audit_unavailable"):
            await virustotal_enrich(
                "domain",
                "example.com",
                api_key="test-key",
                client=client,
                audit_db=db,
            )

    assert provider_called is False
