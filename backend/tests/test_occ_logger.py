"""
backend/tests/test_occ_logger.py — Smoke tests for the OCC event logging service.

These tests verify:
1. Each logger function returns False gracefully when Supabase is not configured
   (no env vars set) — i.e., logging never raises.
2. The Pydantic models accept valid payloads without validation errors.
3. The request_context middleware correctly generates and propagates request IDs.

Run with:
    pytest backend/tests/test_occ_logger.py -v
"""
from __future__ import annotations

import asyncio
import os
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Ensure Supabase is NOT configured for unit tests (no real HTTP calls)
# ---------------------------------------------------------------------------
os.environ.pop("SUPABASE_URL", None)
os.environ.pop("SUPABASE_SERVICE_ROLE_KEY", None)


# ---------------------------------------------------------------------------
# Import after clearing env vars
# ---------------------------------------------------------------------------
from backend.occ_operator.occ_logger import (
    create_approval_request,
    fire_log_error,
    log_agent_activity,
    log_ai_request,
    log_error,
    log_rag_document,
    log_tool_call,
    upsert_user_plan,
)
from backend.occ_operator.occ_models import (
    AgentActivityLogInsert,
    AIRequestLogInsert,
    ApprovalQueueInsert,
    ErrorLogInsert,
    RAGDocumentInsert,
    ToolCallLogInsert,
    UserPlanUpsert,
)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------
def run(coro):
    """Run an async coroutine in a test using a fresh event loop.

    Using asyncio.get_event_loop() is fragile when other test modules call
    asyncio.run() first, which closes the default loop. Creating a new loop
    explicitly avoids the 'There is no current event loop' RuntimeError.
    """
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


# ---------------------------------------------------------------------------
# 1. Logger functions return False (not raise) when Supabase is not configured
# ---------------------------------------------------------------------------

class TestLoggerGracefulDegradation:
    def test_log_ai_request_no_config(self):
        result = run(log_ai_request(model="gpt-4o", prompt_tokens=10, total_tokens=10))
        assert result is False

    def test_log_tool_call_no_config(self):
        result = run(log_tool_call(agent_id="hermes", tool_name="github_api"))
        assert result is False

    def test_log_agent_activity_no_config(self):
        result = run(log_agent_activity(agent_id="tars", event_type="started"))
        assert result is False

    def test_log_error_no_config(self):
        result = run(log_error(error_type="runtime", message="test error"))
        assert result is False

    def test_create_approval_request_no_config(self):
        result = run(create_approval_request(
            title="Deploy to production",
            action_type="deploy",
        ))
        assert result is False

    def test_log_rag_document_no_config(self):
        result = run(log_rag_document(title="Devonn Architecture.pdf", file_type="pdf"))
        assert result is False

    def test_upsert_user_plan_no_config(self):
        result = run(upsert_user_plan(user_id=str(uuid.uuid4()), plan_name="pro"))
        assert result is False

    def test_fire_log_error_no_config_does_not_raise(self):
        """fire_log_error must never raise, even without an event loop."""
        fire_log_error("runtime", "test fire_log_error", severity="warning")


# ---------------------------------------------------------------------------
# 2. Pydantic models accept valid payloads
# ---------------------------------------------------------------------------

class TestOCCModels:
    def test_ai_request_log_insert(self):
        m = AIRequestLogInsert(
            model="gpt-4o",
            provider="openai",
            prompt_tokens=100,
            completion_tokens=50,
            total_tokens=150,
            cost_usd=0.000225,
            latency_ms=342,
            status="success",
            request_id="req-abc123",
            endpoint="/api/chat",
        )
        assert m.model == "gpt-4o"
        assert m.total_tokens == 150

    def test_tool_call_log_insert(self):
        m = ToolCallLogInsert(
            agent_id="hermes",
            tool_name="github_create_pr",
            tool_input={"title": "feat: new feature"},
            tool_output={"pr_number": 42},
            status="success",
            duration_ms=1200,
        )
        assert m.tool_name == "github_create_pr"
        assert m.tool_output["pr_number"] == 42

    def test_agent_activity_log_insert(self):
        m = AgentActivityLogInsert(
            agent_id="tars",
            event_type="completed",
            agent_name="TARS",
            duration_ms=5000,
            tokens_used=2000,
            cost_usd=0.003,
            status="success",
        )
        assert m.event_type == "completed"
        assert m.tokens_used == 2000

    def test_error_log_insert(self):
        m = ErrorLogInsert(
            error_type="api",
            message="OpenAI rate limit exceeded",
            severity="warning",
            service="backend",
            endpoint="/api/chat",
        )
        assert m.severity == "warning"
        assert m.resolved is False

    def test_approval_queue_insert(self):
        m = ApprovalQueueInsert(
            title="Merge to main",
            action_type="deploy",
            priority="high",
            description="Deploy OCC event logging layer",
        )
        assert m.status == "pending"
        assert m.priority == "high"

    def test_user_plan_upsert(self):
        uid = str(uuid.uuid4())
        m = UserPlanUpsert(
            user_id=uid,
            plan_name="enterprise",
            plan_tier=3,
            tokens_limit=10_000_000,
            requests_limit=100_000,
        )
        assert m.user_id == uid
        assert m.plan_tier == 3

    def test_rag_document_insert(self):
        m = RAGDocumentInsert(
            title="Devonn Architecture Overview",
            file_type="pdf",
            file_size_bytes=204_800,
            status="processing",
            namespace="devonn-core",
            tags=["architecture", "overview"],
        )
        assert m.namespace == "devonn-core"
        assert "architecture" in m.tags


# ---------------------------------------------------------------------------
# 3. Logger functions succeed when Supabase IS configured (mocked HTTP)
# ---------------------------------------------------------------------------

class TestLoggerWithMockedSupabase:
    """Verify logger functions call the Supabase REST API correctly when configured."""

    @pytest.fixture(autouse=True)
    def set_env(self, monkeypatch):
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
        # Reload module to pick up new env vars
        import importlib
        import backend.occ_operator.occ_logger as mod
        importlib.reload(mod)
        # Re-import the functions after reload
        self.log_ai_request = mod.log_ai_request
        self.log_tool_call = mod.log_tool_call
        self.log_error = mod.log_error

    def test_log_ai_request_calls_supabase(self):
        mock_response = MagicMock()
        mock_response.status_code = 201

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            result = run(self.log_ai_request(
                model="gpt-4o",
                prompt_tokens=100,
                total_tokens=100,
                cost_usd=0.0002,
            ))
            assert result is True

    def test_log_error_calls_supabase(self):
        mock_response = MagicMock()
        mock_response.status_code = 201

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            result = run(self.log_error(
                error_type="api",
                message="Test error",
                severity="error",
            ))
            assert result is True


# ---------------------------------------------------------------------------
# 4. RequestContextMiddleware smoke test
# ---------------------------------------------------------------------------

class TestRequestContextMiddleware:
    def test_get_request_id_default(self):
        from backend.middleware.request_context import get_request_id
        # Outside a request context, should return empty string (default)
        result = get_request_id()
        assert isinstance(result, str)

    def test_context_var_set_and_reset(self):
        from backend.middleware.request_context import _request_id_var, get_request_id
        token = _request_id_var.set("test-request-id-123")
        assert get_request_id() == "test-request-id-123"
        _request_id_var.reset(token)
        assert get_request_id() == ""
