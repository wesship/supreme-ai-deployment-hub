from __future__ import annotations

import asyncio
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from backend.app.routers import moneyhub
from backend.app.security.approval_execution import ApprovalExecutionService
from backend.market_intelligence.models import MarketIntelligenceQuery
from backend.market_intelligence.router import market_intelligence_query


ROOT = Path(__file__).resolve().parents[2]


class _Response:
    def __init__(self, data=None):
        self.data = data or []


class _ActionTable:
    def __init__(self, rows: list[dict[str, object]], *, reject_claim: bool = False):
        self.rows = rows
        self.reject_claim = reject_claim
        self.filters: list[tuple[str, object]] = []
        self.payload: dict[str, object] | None = None
        self.mode = "select"

    def select(self, *_args):
        self.mode = "select"
        return self

    def update(self, payload):
        self.mode = "update"
        self.payload = payload
        return self

    def eq(self, key, value):
        self.filters.append((key, value))
        return self

    def limit(self, _value):
        return self

    def execute(self):
        matches = [row for row in self.rows if all(row.get(key) == value for key, value in self.filters)]
        if self.mode == "select":
            return _Response(matches)
        if self.reject_claim and ("status", "approved") in self.filters:
            return _Response([])
        for row in matches:
            row.update(self.payload or {})
        return _Response(matches)


class _ActionDB:
    def __init__(self, rows: list[dict[str, object]], *, reject_claim: bool = False):
        self.rows = rows
        self.reject_claim = reject_claim

    def table(self, name):
        assert name == "hermes_security_actions"
        return _ActionTable(self.rows, reject_claim=self.reject_claim)


def _approved_action() -> dict[str, object]:
    return {
        "id": "a1",
        "agent_name": "audit-test",
        "action_type": "block_ip",
        "status": "approved",
        "details": {"source": "audit-test"},
    }


def test_market_query_defaults_to_non_persisting():
    assert MarketIntelligenceQuery(query="market breadth review").save_to_dkos is False


def test_public_market_query_rejects_persistence_requests():
    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            market_intelligence_query(
                MarketIntelligenceQuery(query="market breadth review", save_to_dkos=True)
            )
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_security_executor_claims_action_before_provider_call():
    row = _approved_action()

    async def executor(action):
        assert action["status"] == "executing"
        return {"status": "success", "provider_ref": "dry-run-1"}

    result = await ApprovalExecutionService(_ActionDB([row]), {"block_ip": executor}).execute_approved("a1")

    assert result["status"] == "executed"
    assert row["status"] == "executed"
    assert row["details"]["execution"]["execution_id"]


@pytest.mark.asyncio
async def test_security_executor_does_not_run_when_atomic_claim_is_lost():
    executor_called = False

    async def executor(_action):
        nonlocal executor_called
        executor_called = True
        return {"status": "success"}

    with pytest.raises(RuntimeError, match="concurrently"):
        await ApprovalExecutionService(
            _ActionDB([_approved_action()], reject_claim=True),
            {"block_ip": executor},
        ).execute_approved("a1")
    assert executor_called is False


@pytest.mark.asyncio
async def test_moneyhub_translates_successful_non_json_response_to_bad_gateway(monkeypatch):
    class InvalidJsonResponse:
        status_code = 200

        def json(self):
            raise ValueError("not JSON")

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return False

        async def post(self, *_args, **_kwargs):
            return InvalidJsonResponse()

    monkeypatch.setattr(moneyhub, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(moneyhub, "SUPABASE_SERVICE_ROLE_KEY", "service-role-test")
    monkeypatch.setattr(moneyhub.httpx, "AsyncClient", lambda **_kwargs: FakeClient())

    payload = moneyhub.EconomicEventIn(
        kind="revenue",
        agent_id="agent-1",
        provider="provider",
        provider_event_id="event-1",
        source="audit-test",
        amount="1.00",
    )
    with pytest.raises(HTTPException) as exc:
        await moneyhub._record_event(SimpleNamespace(user_id="user-1"), payload)
    assert exc.value.status_code == 502
    assert exc.value.detail == "MoneyHub ledger returned an invalid response."


def test_security_action_schema_migration_matches_runtime_contract():
    migration = (
        ROOT / "supabase" / "migrations" / "20260912094500_hermes_security_action_approval_state.sql"
    ).read_text(encoding="utf-8")
    for required in (
        "ADD COLUMN IF NOT EXISTS agent_name",
        "ADD COLUMN IF NOT EXISTS status",
        "ADD COLUMN IF NOT EXISTS details",
        "'pending_approval'",
        "'executing'",
        "'execution_failed'",
        "WHERE status = 'legacy_pending'",
    ):
        assert required in migration


def test_liquidity_raw_data_migration_denies_client_access():
    migration = (
        ROOT / "supabase" / "migrations" / "20260912095500_lock_down_liquidity_pool_raw.sql"
    ).read_text(encoding="utf-8")
    assert "ENABLE ROW LEVEL SECURITY" in migration
    assert "REVOKE ALL ON TABLE public.liquidity_pool_raw FROM PUBLIC, anon, authenticated" in migration
    assert "GRANT ALL ON TABLE public.liquidity_pool_raw TO service_role" in migration


def test_edge_function_security_configuration_is_fail_closed():
    config = (ROOT / "supabase" / "config.toml").read_text(encoding="utf-8")
    workflow = (ROOT / ".github" / "workflows" / "supabase-edge-functions.yml").read_text(encoding="utf-8")
    mcp_gateway = (ROOT / "supabase" / "functions" / "mcp-gateway" / "index.ts").read_text(encoding="utf-8")
    ai_router = (ROOT / "supabase" / "functions" / "ai-router" / "index.ts").read_text(encoding="utf-8")

    assert "[functions.generate-screenplay]\nverify_jwt = true" in config
    assert "[functions.generate-film]\nverify_jwt = true" in config
    assert "[functions.mcp-gateway]\nverify_jwt = true" in config
    assert "[functions.enqueue-task]\nverify_jwt = true" in config
    assert "environment:\n      name: Production" in workflow
    assert "github.event_name == 'workflow_dispatch' && inputs.confirm_production_deploy" in workflow
    assert "--no-verify-jwt" not in workflow
    assert "supabase functions deploy ai-router" in workflow
    assert "supabase functions deploy mcp-gateway" in workflow
    assert "x-mcp-gateway-url" not in mcp_gateway
    assert "body.gatewayUrl" not in mcp_gateway
    assert 'host.startsWith("[") && host.endsWith("]")' in mcp_gateway
    assert "redirect: \"error\"" in mcp_gateway
    assert "AI_ROUTER_SMS_APPROVER_SUBJECTS" in ai_router
    assert "SMS_NOT_AUTHORIZED" in ai_router


def test_market_intelligence_ui_keeps_public_queries_non_persisting():
    source = (ROOT / "src" / "pages" / "MarketIntelligence.tsx").read_text(encoding="utf-8")
    assert "useState(true)" not in source
    assert "save_to_dkos: false" in source
    assert "OCC workflow" in source


def test_python_coverage_workflow_runs_backend_suite_without_masking_errors():
    workflow = (ROOT / ".github" / "workflows" / "testing.yml").read_text(encoding="utf-8")
    assert "python -m pytest backend/tests" in workflow
    assert "--cov=backend" in workflow
    assert "--cov-omit" not in workflow
    assert '|| echo "No Python tests found - skipping"' not in workflow
