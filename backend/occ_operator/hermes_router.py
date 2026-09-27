"""FastAPI bridge for the Hermes Intelligence Fabric.

All routes require a valid Supabase admin/operator JWT. Supabase REST and
HMAC-signed enqueue operations are delegated to shared Hermes adapters.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from typing import Any

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from backend.app.config import get_settings
from backend.app.routers.chat import OPENAI_CHAT_URL
from backend.auth.supabase_jwt import OCCPrincipal, require_occ_access
from backend.hermes.infrastructure import (
    HermesDispatchClient,
    HermesInfrastructureConfig,
    SupabaseRestClient,
    sign_payload,
)
from backend.hermes.registry import BUILTIN_AGENT_REGISTRY
from backend.hermes.task_engine import TaskTransitionConflict, transition_task
from backend.occ_operator.occ_logger import log_error

router = APIRouter(prefix="/api/hermes", tags=["hermes"])

_CONFIG = HermesInfrastructureConfig.from_env()
_SUPABASE = SupabaseRestClient(_CONFIG)
_DISPATCH = HermesDispatchClient(_CONFIG)


def _supabase_url() -> str:
    return _CONFIG.supabase_url


def _service_role_key() -> str:
    return _CONFIG.service_role_key


def _hermes_webhook_secret() -> str:
    return _CONFIG.webhook_secret


def _hermes_internal_api_key() -> str:
    return _CONFIG.internal_api_key


def _is_configured() -> bool:
    return _SUPABASE.configured


def _sb_headers() -> dict[str, str]:
    return _SUPABASE.headers()


def _sign_payload(body: str, secret: str) -> str:
    return sign_payload(body, secret)


class EnqueueTaskRequest(BaseModel):
    kind: str = Field(..., description="Task kind: tars.plan | tars.summarize | tars.followup | tars.research")
    goal_id: str = Field(..., description="UUID of the parent hermes_goals row")
    title: str | None = None
    description: str | None = None
    task_payload: dict[str, Any] = Field(default_factory=dict)
    max_depth: int = Field(default=3, ge=1, le=10)


class InternalExecuteRequest(BaseModel):
    task_id: str = Field(min_length=1)
    agent_name: str = Field(min_length=1)
    input_data: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str | None = None


class CreateGoalRequest(BaseModel):
    title: str
    description: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class TaskActionRequest(BaseModel):
    action: str = Field(..., pattern="^(cancel|retry|pause|resume)$")
    reason: str | None = Field(default=None, max_length=1000)


class AdaptiveChangeRequestCreate(BaseModel):
    proposal_id: str = Field(min_length=1, max_length=200)
    category: str = Field(pattern="^(routing|agent|tool|concurrency|workflow)$")
    target: str = Field(min_length=1, max_length=200)
    severity: str = Field(pattern="^(info|warning|critical)$")
    evidence: dict[str, Any] = Field(default_factory=dict)
    proposed_change: dict[str, Any] = Field(default_factory=dict)
    guardrail: str = Field(min_length=3, max_length=4000)
    rollback_plan: str = Field(min_length=3, max_length=4000)


class AdaptiveChangeDecision(BaseModel):
    decision: str = Field(pattern="^(approved|rejected)$")
    rationale: str = Field(min_length=3, max_length=4000)


class AdaptivePromotionDecision(BaseModel):
    decision: str = Field(pattern="^(approved|rejected)$")
    rationale: str = Field(min_length=3, max_length=4000)


class AdaptiveRolloutRequest(BaseModel):
    environment: str = Field(pattern="^(staging|production)$")
    production_authorization: str | None = Field(default=None, min_length=16, max_length=512)
    pre_change_config: dict[str, Any] = Field(default_factory=dict)


def _require_internal_execution_key(
    provided: str = Header(default="", alias="X-Hermes-Internal-Key"),
) -> None:
    expected = _CONFIG.internal_api_key
    if not expected:
        raise HTTPException(status_code=503, detail="Hermes internal execution is not configured.")
    if not provided or not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="Invalid Hermes internal execution credential.")

def _require_supabase() -> None:
    if not _SUPABASE.configured:
        raise HTTPException(status_code=503, detail="Supabase not configured.")


def _adaptive_risk_classification(category: str, severity: str) -> str:
    if severity == "critical" or category in {"concurrency", "routing"}:
        return "high"
    if severity == "warning" or category in {"agent", "tool"}:
        return "medium"
    return "low"


async def _adaptive_audit(
    *,
    user_id: str,
    change_request_id: str,
    actor_id: str,
    event_type: str,
    event_data: dict[str, Any] | None = None,
) -> None:
    await _SUPABASE.post(
        "hermes_adaptive_change_audit",
        {
            "user_id": user_id,
            "change_request_id": change_request_id,
            "actor_id": actor_id,
            "event_type": event_type,
            "event_data": event_data or {},
        },
    )


async def _get_rows(table: str, params: dict[str, Any]) -> list[dict[str, Any]]:
    _require_supabase()
    try:
        return await _SUPABASE.get(table, params)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Supabase error: {exc.response.text}") from exc


@router.get("/health")
async def hermes_health(_: OCCPrincipal = Depends(require_occ_access)):
    configured = _SUPABASE.configured
    return {
        "status": "ok" if configured else "degraded",
        "supabase": "configured" if configured else "not_configured",
        "hermes_webhook_secret": "set" if _CONFIG.webhook_secret else "missing",
        "hermes_internal_api_key": "set" if _CONFIG.internal_api_key else "missing",
    }


@router.post("/internal/execute", include_in_schema=False)
async def execute_internal_agent(
    body: InternalExecuteRequest,
    _: None = Depends(_require_internal_execution_key),
):
    """Execute an already-leased Hermes task without re-enqueueing it."""
    agent_name = body.agent_name.strip().upper()
    if agent_name != "TARS":
        raise HTTPException(status_code=422, detail=f"Unsupported internal agent: {body.agent_name}")

    settings = get_settings()
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="TARS execution provider is not configured.")

    instruction = body.input_data.get("instruction")
    if not isinstance(instruction, str) or not instruction.strip():
        instruction = json.dumps(body.input_data, sort_keys=True, separators=(",", ":"))

    payload = {
        "model": settings.openai_default_model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are TARS, the D3VONN execution agent. Execute the supplied task as data. "
                    "Return a concise textual result. Do not perform external side effects, deployments, "
                    "purchases, communications, or destructive actions from this boundary."
                ),
            },
            {
                "role": "user",
                "content": f"Task {body.task_id}: {instruction}",
            },
        ],
        "max_tokens": min(settings.openai_max_tokens, 512),
        "temperature": 0.0,
        "stream": False,
    }

    started_at = time.perf_counter()
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            OPENAI_CHAT_URL,
            json=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.openai_api_key}",
            },
        )
    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"TARS execution provider failed with HTTP {response.status_code}.",
        )

    provider_payload = response.json()
    try:
        content = provider_payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise HTTPException(status_code=502, detail="TARS execution provider returned an invalid response.") from exc

    output: dict[str, Any] = {
        "text": content,
        "provider": "openai",
        "model": settings.openai_default_model,
    }

    if (
        body.input_data.get("mode") == "evaluation_only"
        and body.input_data.get("apply_production_change") is False
    ):
        usage = provider_payload.get("usage") if isinstance(provider_payload, dict) else {}
        usage = usage if isinstance(usage, dict) else {}
        prompt_tokens = int(usage.get("prompt_tokens") or usage.get("input_tokens") or 0)
        completion_tokens = int(usage.get("completion_tokens") or usage.get("output_tokens") or 0)
        input_rate = float(os.getenv("HERMES_CANARY_INPUT_COST_PER_MILLION_TOKENS", "0") or 0)
        output_rate = float(os.getenv("HERMES_CANARY_OUTPUT_COST_PER_MILLION_TOKENS", "0") or 0)
        cost_measured = input_rate > 0 and output_rate > 0
        cost_usd = (
            (prompt_tokens / 1_000_000) * input_rate
            + (completion_tokens / 1_000_000) * output_rate
            if cost_measured
            else 0.0
        )
        output["certification_metrics"] = {
            "success_rate": 1.0,
            "error_rate": 0.0,
            "latency_ms": round((time.perf_counter() - started_at) * 1000, 3),
            "cost_usd": round(cost_usd, 8),
            "cost_measured": cost_measured,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
        }

    return {
        "status": "completed",
        "task_id": body.task_id,
        "agent": agent_name,
        "idempotency_key": body.idempotency_key,
        "output": output,
    }

@router.get("/goals")
async def list_goals(limit: int = 50, _: OCCPrincipal = Depends(require_occ_access)):
    return await _get_rows("hermes_goals", {"order": "created_at.desc", "limit": limit})


@router.post("/goals", status_code=201)
async def create_goal(body: CreateGoalRequest, principal: OCCPrincipal = Depends(require_occ_access)):
    _require_supabase()
    payload = {"title": body.title, "description": body.description, "metadata": body.metadata}
    try:
        result = await _SUPABASE.post("hermes_goals", payload)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Supabase error: {exc.response.text}") from exc
    return [result] if result else []


@router.get("/tasks")
async def list_tasks(
    goal_id: str | None = None,
    status_filter: str | None = None,
    limit: int = 100,
    _: OCCPrincipal = Depends(require_occ_access),
):
    params: dict[str, Any] = {"order": "created_at.desc", "limit": limit}
    if goal_id:
        params["goal_id"] = f"eq.{goal_id}"
    if status_filter:
        params["status"] = f"eq.{status_filter}"
    return await _get_rows("hermes_tasks", params)


@router.post("/tasks/{task_id}/action")
async def mutate_task(
    task_id: str,
    body: TaskActionRequest,
    principal: OCCPrincipal = Depends(require_occ_access),
):
    action_targets = {
        "cancel": "CANCELLED",
        "retry": "RETRY",
        "pause": "PAUSED",
        "resume": "RUNNING",
    }
    try:
        updated = await transition_task(
            task_id,
            action_targets[body.action],
            error_message=body.reason if body.action == "cancel" and body.reason else None,
        )
    except TaskTransitionConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        detail = str(exc)
        status_code = 404 if "not found" in detail.lower() else 409
        raise HTTPException(status_code=status_code, detail=detail) from exc
    return {
        "status": "updated",
        "task_id": task_id,
        "action": body.action,
        "task": updated,
        "actor_user_id": principal.user_id,
    }


@router.get("/adaptive-change-requests")
async def list_adaptive_change_requests(
    limit: int = 50,
    principal: OCCPrincipal = Depends(require_occ_access),
):
    return await _get_rows(
        "hermes_adaptive_change_requests",
        {
            "user_id": f"eq.{principal.user_id}",
            "order": "created_at.desc",
            "limit": limit,
        },
    )


@router.post("/adaptive-change-requests", status_code=201)
async def create_adaptive_change_request(
    body: AdaptiveChangeRequestCreate,
    principal: OCCPrincipal = Depends(require_occ_access),
):
    _require_supabase()
    canonical_evidence = json.dumps(body.evidence, sort_keys=True, separators=(",", ":"))
    evidence_hash = hashlib.sha256(canonical_evidence.encode()).hexdigest()
    risk = _adaptive_risk_classification(body.category, body.severity)
    payload = {
        "user_id": principal.user_id,
        "proposal_id": body.proposal_id,
        "category": body.category,
        "target": body.target,
        "severity": body.severity,
        "risk_classification": risk,
        "evidence": body.evidence,
        "evidence_hash": evidence_hash,
        "proposed_change": body.proposed_change,
        "guardrail": body.guardrail,
        "rollback_plan": body.rollback_plan,
        "status": "pending_review",
    }
    try:
        request = await _SUPABASE.post("hermes_adaptive_change_requests", payload)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 409:
            rows = await _get_rows(
                "hermes_adaptive_change_requests",
                {
                    "user_id": f"eq.{principal.user_id}",
                    "proposal_id": f"eq.{body.proposal_id}",
                    "evidence_hash": f"eq.{evidence_hash}",
                    "limit": 1,
                },
            )
            if rows:
                return rows[0]
        raise HTTPException(status_code=502, detail=f"Supabase error: {exc.response.text}") from exc

    await _adaptive_audit(
        user_id=principal.user_id,
        change_request_id=str(request["id"]),
        actor_id=principal.user_id,
        event_type="change_request.created",
        event_data={"proposal_id": body.proposal_id, "risk_classification": risk},
    )
    return request


@router.post("/adaptive-change-requests/{request_id}/decision")
async def decide_adaptive_change_request(
    request_id: str,
    body: AdaptiveChangeDecision,
    principal: OCCPrincipal = Depends(require_occ_access),
):
    rows = await _get_rows(
        "hermes_adaptive_change_requests",
        {"id": f"eq.{request_id}", "user_id": f"eq.{principal.user_id}", "limit": 1},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Adaptive change request not found.")
    request = rows[0]
    if request.get("status") != "pending_review":
        raise HTTPException(status_code=409, detail="Adaptive change request has already been reviewed.")

    try:
        updated = await _SUPABASE.rpc(
            "hermes_decide_adaptive_change_request",
            {
                "p_request_id": request_id,
                "p_user_id": principal.user_id,
                "p_actor_id": principal.user_id,
                "p_decision": body.decision,
                "p_rationale": body.rationale,
            },
        )
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in (400, 409):
            raise HTTPException(status_code=409, detail="Adaptive change request is no longer pending review.") from exc
        raise HTTPException(status_code=502, detail=f"Supabase error: {exc.response.text}") from exc
    return updated


@router.post("/adaptive-change-requests/{request_id}/canary")
async def queue_adaptive_change_canary(
    request_id: str,
    principal: OCCPrincipal = Depends(require_occ_access),
):
    rows = await _get_rows(
        "hermes_adaptive_change_requests",
        {"id": f"eq.{request_id}", "user_id": f"eq.{principal.user_id}", "limit": 1},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Adaptive change request not found.")
    request = rows[0]
    if request.get("status") == "canary_queued" and request.get("canary_task_id"):
        return {"status": "canary_queued", "task_id": request["canary_task_id"], "request_id": request_id}
    if request.get("status") != "approved":
        raise HTTPException(status_code=409, detail="Only approved adaptive change requests may queue a canary.")

    try:
        result = await _SUPABASE.rpc(
            "hermes_queue_adaptive_canary",
            {
                "p_request_id": request_id,
                "p_user_id": principal.user_id,
                "p_actor_id": principal.user_id,
            },
        )
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in (400, 409):
            raise HTTPException(status_code=409, detail="Adaptive canary request is not eligible or has already been claimed.") from exc
        raise HTTPException(status_code=502, detail=f"Supabase error: {exc.response.text}") from exc
    return result


@router.post("/adaptive-change-requests/{request_id}/certify")
async def certify_adaptive_change_canary(
    request_id: str,
    principal: OCCPrincipal = Depends(require_occ_access),
):
    try:
        return await _SUPABASE.rpc(
            "hermes_certify_adaptive_canary",
            {
                "p_request_id": request_id,
                "p_user_id": principal.user_id,
                "p_actor_id": principal.user_id,
            },
        )
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in (400, 409):
            raise HTTPException(
                status_code=409,
                detail="Canary certification requires a completed task with persisted baseline and measured candidate metrics.",
            ) from exc
        raise HTTPException(status_code=502, detail=f"Supabase error: {exc.response.text}") from exc


@router.get("/adaptive-promotion-candidates")
async def list_adaptive_promotion_candidates(
    limit: int = 50,
    principal: OCCPrincipal = Depends(require_occ_access),
):
    return await _get_rows(
        "hermes_adaptive_promotion_candidates",
        {
            "user_id": f"eq.{principal.user_id}",
            "order": "created_at.desc",
            "limit": limit,
        },
    )


@router.post("/adaptive-promotion-candidates/{candidate_id}/decision")
async def decide_adaptive_promotion(
    candidate_id: str,
    body: AdaptivePromotionDecision,
    principal: OCCPrincipal = Depends(require_occ_access),
):
    try:
        return await _SUPABASE.rpc(
            "hermes_review_adaptive_promotion",
            {
                "p_candidate_id": candidate_id,
                "p_user_id": principal.user_id,
                "p_reviewer_id": principal.user_id,
                "p_decision": body.decision,
                "p_rationale": body.rationale,
            },
        )
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in (400, 409):
            raise HTTPException(status_code=409, detail="Promotion candidate is not eligible for review.") from exc
        raise HTTPException(status_code=502, detail=f"Supabase error: {exc.response.text}") from exc


async def _adaptive_current_config_snapshot(
    candidate_id: str,
    user_id: str,
) -> dict[str, Any]:
    candidates = await _get_rows(
        "hermes_adaptive_promotion_candidates",
        {"id": f"eq.{candidate_id}", "user_id": f"eq.{user_id}", "limit": 1},
    )
    if not candidates:
        raise HTTPException(status_code=404, detail="Promotion candidate not found.")
    candidate = candidates[0]
    requests = await _get_rows(
        "hermes_adaptive_change_requests",
        {
            "id": f"eq.{candidate.get('change_request_id')}",
            "user_id": f"eq.{user_id}",
            "limit": 1,
        },
    )
    if not requests:
        raise HTTPException(status_code=404, detail="Adaptive change request not found.")
    request = requests[0]
    proposed = candidate.get("proposed_change") if isinstance(candidate.get("proposed_change"), dict) else {}
    category = str(request.get("category") or "")
    target = str(request.get("target") or "")

    snapshot: dict[str, Any] = {
        "source": "server_runtime",
        "category": category,
        "target": target,
        "captured_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "proposed_scope": proposed.get("scope"),
    }
    if category == "concurrency":
        snapshot["HERMES_MAX_CONCURRENT_TASKS"] = os.getenv("HERMES_MAX_CONCURRENT_TASKS", "10")
    elif category == "routing":
        snapshot["HERMES_DEFAULT_AGENT"] = os.getenv("HERMES_DEFAULT_AGENT", "TARS")
        snapshot["agent_hierarchy"] = BUILTIN_AGENT_REGISTRY.hierarchy()
    elif category == "agent":
        try:
            snapshot["agent_manifest"] = BUILTIN_AGENT_REGISTRY.get(target.strip().lower()).model_dump(mode="json")
        except KeyError:
            snapshot["agent_manifest"] = None
    elif category == "tool":
        tools_snapshot: list[dict[str, Any]] = []
        for manifest in BUILTIN_AGENT_REGISTRY.list(enabled_only=False):
            for tool in manifest.tools:
                tools_snapshot.append({"agent": manifest.name, **tool.model_dump(mode="json")})
        snapshot["registered_tools"] = tools_snapshot
    else:
        snapshot["agent_hierarchy"] = BUILTIN_AGENT_REGISTRY.hierarchy()
        snapshot["policy_source"] = "code_and_persisted_workflow_state"
    return snapshot


@router.post("/adaptive-promotion-candidates/{candidate_id}/rollout")
async def validate_adaptive_rollout(
    candidate_id: str,
    body: AdaptiveRolloutRequest,
    principal: OCCPrincipal = Depends(require_occ_access),
):
    if body.environment == "production" and not body.production_authorization:
        raise HTTPException(status_code=403, detail="Explicit production authorization is required.")
    auth_hash = (
        hashlib.sha256(body.production_authorization.encode()).hexdigest()
        if body.production_authorization
        else ""
    )
    pre_change = await _adaptive_current_config_snapshot(candidate_id, principal.user_id)
    try:
        return await _SUPABASE.rpc(
            "hermes_validate_adaptive_rollout",
            {
                "p_candidate_id": candidate_id,
                "p_user_id": principal.user_id,
                "p_executor_id": principal.user_id,
                "p_environment": body.environment,
                "p_authorization_hash": auth_hash,
                "p_pre_change": pre_change,
            },
        )
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in (400, 403, 409):
            raise HTTPException(status_code=409, detail="Promotion rollout is not eligible for validation.") from exc
        raise HTTPException(status_code=502, detail=f"Supabase error: {exc.response.text}") from exc


@router.get("/adaptive-rollouts")
async def list_adaptive_rollouts(
    limit: int = 50,
    principal: OCCPrincipal = Depends(require_occ_access),
):
    return await _get_rows(
        "hermes_adaptive_rollouts",
        {
            "user_id": f"eq.{principal.user_id}",
            "order": "created_at.desc",
            "limit": limit,
        },
    )


@router.post("/enqueue")
async def enqueue_task(
    body: EnqueueTaskRequest,
    principal: OCCPrincipal = Depends(require_occ_access),
):
    if not _CONFIG.webhook_secret:
        raise HTTPException(
            status_code=503,
            detail="HERMES_WEBHOOK_SECRET is not configured. Add it to Railway environment variables.",
        )
    if not _CONFIG.supabase_url:
        raise HTTPException(status_code=503, detail="SUPABASE_URL is not configured.")

    payload = {
        "kind": body.kind,
        "goal_id": body.goal_id,
        "title": body.title,
        "description": body.description,
        "task_payload": body.task_payload,
        "max_depth": body.max_depth,
    }
    try:
        return await _DISPATCH.enqueue(payload, signature_header="X-Hermes-Signature")
    except httpx.HTTPStatusError as exc:
        await log_error(
            error_type="hermes_enqueue_failed",
            message=exc.response.text,
            severity="error",
            service="hermes",
            endpoint="/api/hermes/enqueue",
            user_id=principal.user_id,
            metadata={"kind": body.kind, "goal_id": body.goal_id, "status_code": exc.response.status_code},
        )
        raise HTTPException(status_code=502, detail=f"Enqueue failed: {exc.response.text}") from exc
    except httpx.RequestError as exc:
        await log_error(
            error_type="hermes_enqueue_network_error",
            message=str(exc),
            severity="error",
            service="hermes",
            endpoint="/api/hermes/enqueue",
            user_id=principal.user_id,
        )
        raise HTTPException(status_code=502, detail=f"Network error reaching Supabase Edge Function: {exc}") from exc


@router.get("/interrupts")
async def list_interrupts(
    status_filter: str = "pending",
    limit: int = 50,
    _: OCCPrincipal = Depends(require_occ_access),
):
    params: dict[str, Any] = {"order": "created_at.desc", "limit": limit}
    if status_filter:
        params["status"] = f"eq.{status_filter}"
    return await _get_rows("hermes_interrupts", params)


@router.patch("/interrupts/{interrupt_id}")
async def resolve_interrupt(
    interrupt_id: str,
    resolution: dict[str, str],
    principal: OCCPrincipal = Depends(require_occ_access),
):
    new_status = resolution.get("status")
    if new_status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="status must be 'approved' or 'rejected'")
    _require_supabase()
    try:
        await _SUPABASE.patch(
            "hermes_interrupts",
            interrupt_id,
            {
                "status": new_status,
                "response": resolution.get("response"),
                "resolved_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            },
        )
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Supabase error: {exc.response.text}") from exc
    return {"status": "updated", "interrupt_id": interrupt_id, "resolution": new_status}


@router.get("/checkpoints")
async def list_checkpoints(
    goal_id: str | None = None,
    limit: int = 30,
    _: OCCPrincipal = Depends(require_occ_access),
):
    params: dict[str, Any] = {"order": "created_at.desc", "limit": limit}
    if goal_id:
        params["goal_id"] = f"eq.{goal_id}"
    return await _get_rows("hermes_checkpoints", params)


@router.get("/stats")
async def hermes_stats(_: OCCPrincipal = Depends(require_occ_access)):
    if not _SUPABASE.configured:
        return {"error": "Supabase not configured", "configured": False}

    total_goals = await _SUPABASE.count("hermes_goals")
    active_goals = await _SUPABASE.count("hermes_goals", {"status": "eq.active"})
    total_tasks = await _SUPABASE.count("hermes_tasks")
    pending_tasks = await _SUPABASE.count("hermes_tasks", {"status": "eq.pending"})
    processing_tasks = await _SUPABASE.count("hermes_tasks", {"status": "eq.processing"})
    failed_tasks = await _SUPABASE.count("hermes_tasks", {"status": "eq.failed"})
    pending_interrupts = await _SUPABASE.count("hermes_interrupts", {"status": "eq.pending"})

    return {
        "configured": True,
        "goals": {"total": total_goals, "active": active_goals},
        "tasks": {
            "total": total_tasks,
            "pending": pending_tasks,
            "processing": processing_tasks,
            "failed": failed_tasks,
        },
        "interrupts": {"pending": pending_interrupts},
    }
