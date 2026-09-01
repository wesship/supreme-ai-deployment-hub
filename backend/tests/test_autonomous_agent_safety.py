"""Safety-boundary tests for autonomous execution and orchestration."""

import time

import pytest
from fastapi import HTTPException

from intelligence.executor.agent_executor import AgentExecutor
from intelligence.executor.safety_policy import (
    ApprovalMode,
    ToolPolicy,
    ToolRisk,
    evaluate_tool_action,
    redact_sensitive_text,
    validate_agent_budget,
)
from intelligence.orchestration.orchestrator import OrchestrationRun, orchestrator


def test_unclassified_tool_is_denied() -> None:
    decision = evaluate_tool_action("unclassified", {}, {})

    assert decision.mode is ApprovalMode.DENY


def test_deployment_and_destructive_actions_require_approval() -> None:
    policies = {
        "release": ToolPolicy(risk=ToolRisk.DEPLOY),
        "storage": ToolPolicy(risk=ToolRisk.WRITE),
    }

    assert (
        evaluate_tool_action("release", {"target": "staging"}, policies).mode
        is ApprovalMode.APPROVAL_REQUIRED
    )
    assert (
        evaluate_tool_action("storage", {"operation": "delete record"}, policies).mode
        is ApprovalMode.APPROVAL_REQUIRED
    )


def test_production_write_requires_approval() -> None:
    policies = {"storage": ToolPolicy(risk=ToolRisk.WRITE)}

    decision = evaluate_tool_action(
        "storage",
        {"environment": "production", "operation": "update"},
        policies,
    )

    assert decision.mode is ApprovalMode.APPROVAL_REQUIRED


@pytest.mark.asyncio
async def test_read_tool_executes_and_redacts_output() -> None:
    executor = AgentExecutor()

    async def read_tool(**_kwargs):
        return "Authorization: top-secret Bearer abc.def.ghi"

    executor.register_tool("read", read_tool, risk_tier=ToolRisk.READ)

    observation, executed = await executor._execute_action(
        "read",
        {},
        started_at=time.monotonic(),
    )

    assert executed is True
    assert "top-secret" not in observation
    assert "abc.def.ghi" not in observation
    assert observation.count("[REDACTED]") == 2


@pytest.mark.asyncio
async def test_approval_boundary_does_not_invoke_handler() -> None:
    executor = AgentExecutor()
    invoked = False

    async def deploy_tool(**_kwargs):
        nonlocal invoked
        invoked = True
        return "deployed"

    executor.register_tool("deploy", deploy_tool, risk_tier=ToolRisk.DEPLOY)

    observation, executed = await executor._execute_action(
        "deploy",
        {"target": "staging"},
        started_at=time.monotonic(),
    )

    assert observation.startswith("Approval required:")
    assert executed is False
    assert invoked is False


def test_expired_agent_budget_fails_closed() -> None:
    decision = validate_agent_budget(
        active_agents=1,
        depth=1,
        tool_calls=0,
        started_at=time.monotonic() - 301,
    )

    assert decision.mode is ApprovalMode.DENY
    assert "runtime" in decision.reason.lower()


def test_sensitive_text_redaction() -> None:
    text = "token=abc123 password: hunter2 Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig"

    redacted = redact_sensitive_text(text)

    assert "abc123" not in redacted
    assert "hunter2" not in redacted
    assert "eyJhbGciOiJIUzI1NiJ9" not in redacted


@pytest.mark.asyncio
async def test_run_status_is_scoped_to_owner() -> None:
    from intelligence.api_router import get_orchestration_run

    run = OrchestrationRun(goal="private goal", user_id="owner-user")
    orchestrator._active_runs[run.run_id] = run
    try:
        with pytest.raises(HTTPException) as exc_info:
            await get_orchestration_run(run.run_id, user_id="different-user")
        assert exc_info.value.status_code == 404
    finally:
        orchestrator._active_runs.pop(run.run_id, None)
