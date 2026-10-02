from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.occ_operator import public_stats_router as stats


@pytest.fixture
def client():
    stats._cache.update(data=None, ts=0)
    app = FastAPI()
    app.include_router(stats.router)
    return TestClient(app)


def test_unconfigured_stats_are_unknown_not_operational(client, monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    response = client.get("/api/public/stats")
    assert response.status_code == 200
    body = response.json()
    assert body["contract"] == "public-stats-v1"
    assert body["active_agents"] is None
    assert body["uptime_percent"] is None
    assert body["system_health"] == "unknown"
    assert body["telemetry_available"] is False
    assert response.headers["cache-control"] == "no-store"


def test_latest_event_wins_and_cache_is_explicit(client, monkeypatch):
    source = AsyncMock(side_effect=[
        [{"agent_id": "a", "event_type": "started"},
         {"agent_id": "a", "event_type": "completed"},
         {"agent_id": "b", "event_type": "completed"}],
        10, 2, 20,
    ])
    monkeypatch.setattr(stats, "_source", source)
    body = client.get("/api/public/stats").json()
    assert body["active_agents"] == 1
    assert body["completed_workflows"] == 10
    assert body["telemetry_available"] is True
    assert body["cached"] is False
    assert client.get("/api/public/stats").json()["cached"] is True
    assert source.await_count == 4


def test_partial_failure_does_not_become_zero_or_get_cached(client, monkeypatch):
    monkeypatch.setattr(stats, "_source", AsyncMock(side_effect=[
        ValueError("missing activity"), 10, ValueError("missing queue"), 20,
    ]))
    body = client.get("/api/public/stats").json()
    assert body["active_agents"] is None
    assert body["queue_pending"] is None
    assert body["total_tasks_processed"] == 20
    assert body["source_status"]["approval_queue"] == "unavailable"
    assert stats._cache["data"] is None


@pytest.mark.asyncio
@pytest.mark.parametrize("status,headers,body,expected", [
    (200, {"content-range": "*/12"}, [], 12),
    (200, {}, [], ValueError),
    (403, {}, {}, httpx.HTTPStatusError),
])
async def test_source_requires_success_and_valid_counts(monkeypatch, status, headers, body, expected):
    monkeypatch.setenv("SUPABASE_URL", "https://storage.invalid")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-only")
    real_client = httpx.AsyncClient
    transport = httpx.MockTransport(lambda request: httpx.Response(status, headers=headers, json=body))
    monkeypatch.setattr(stats.httpx, "AsyncClient", lambda **kw: real_client(transport=transport, **kw))
    if isinstance(expected, type):
        with pytest.raises(expected):
            await stats._source("table", {}, count=True)
    else:
        assert await stats._source("table", {}, count=True) == expected


@pytest.mark.asyncio
@pytest.mark.parametrize("body,expected", [([], []), ({}, ValueError)])
async def test_source_validates_rows(monkeypatch, body, expected):
    monkeypatch.setenv("SUPABASE_URL", "https://storage.invalid")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-only")
    real_client = httpx.AsyncClient
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json=body))
    monkeypatch.setattr(stats.httpx, "AsyncClient", lambda **kw: real_client(transport=transport, **kw))
    if expected is ValueError:
        with pytest.raises(ValueError):
            await stats._source("table", {})
    else:
        assert await stats._source("table", {}) == expected


def test_public_health_reports_configuration_not_connectivity(client, monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    assert client.get("/api/public/health").json()["supabase"] == "not_configured"
    monkeypatch.setenv("SUPABASE_URL", "https://storage.invalid")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-only")
    assert client.get("/api/public/health").json()["supabase"] == "configured"
