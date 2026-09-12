"""Protected controlled-rollout validation for approved AI Films policy changes.

Gate 19 records a reversible rollout snapshot. It does not mutate process
configuration or provider activation. Production remains fail-closed pending a
separate explicit executor.
"""
from __future__ import annotations

import hashlib
import os
from typing import Any, Literal

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field

from backend.ai_films.orchestration import OrchestrationError, SupabaseRLSClient
from backend.ai_films.policy_promotion_review_router import _service_insert, _service_select, _token

router = APIRouter(prefix="/ai-films/policy-promotions", tags=["ai-films", "policy-governance"])


class PromotionRolloutRequest(BaseModel):
    environment: Literal["staging", "production"] = "staging"
    production_authorization: str | None = Field(default=None, min_length=16, max_length=512)


def _current_policy_snapshot(provider: str, style_id: str | None) -> dict[str, Any]:
    executable = [p.strip().lower() for p in os.getenv("AI_FILM_EXECUTABLE_VIDEO_PROVIDERS", "pollo").split(",") if p.strip()]
    return {
        "provider": provider,
        "style_id": style_id,
        "executable_video_providers": executable,
        "policy_source": "process_environment",
    }


def _bounded_post_change(snapshot: dict[str, Any], delta: dict[str, Any], adjustment: int) -> dict[str, Any]:
    if adjustment < -5 or adjustment > 5:
        raise HTTPException(status_code=409, detail="Approved routing adjustment is outside the bounded -5..+5 contract")
    return {
        **snapshot,
        "approved_adjustment": adjustment,
        "approved_runtime_delta": delta,
        "effective_runtime_changed": False,
    }


@router.post("/{change_request_id}/rollouts", status_code=status.HTTP_201_CREATED)
async def create_policy_rollout(
    change_request_id: str,
    body: PromotionRolloutRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    token = _token(authorization)
    try:
        caller = await SupabaseRLSClient(token).current_user()
    except OrchestrationError as exc:
        raise HTTPException(status_code=401, detail="Authenticated rollout executor could not be resolved") from exc

    requests = await _service_select(
        "ai_film_policy_promotion_change_requests",
        {
            "id": f"eq.{change_request_id}",
            "select": "id,owner_id,requestor_id,provider,style_id,proposed_adjustment,proposed_runtime_delta,status",
            "limit": "1",
        },
    )
    if not requests:
        raise HTTPException(status_code=404, detail="Policy promotion change request not found")
    change = requests[0]

    reviews = await _service_select(
        "ai_film_policy_promotion_reviews",
        {
            "change_request_id": f"eq.{change_request_id}",
            "decision": "eq.approved",
            "select": "id,reviewer_id,decision,canary_state",
            "limit": "1",
        },
    )
    if not reviews:
        raise HTTPException(status_code=409, detail="Independent approved second review is required before rollout")
    review = reviews[0]
    if str(review.get("reviewer_id")) == str(change.get("requestor_id")):
        raise HTTPException(status_code=409, detail="Second review is not independent")

    if body.environment == "production" and not body.production_authorization:
        raise HTTPException(status_code=403, detail="Explicit production rollout authorization is required")

    provider = str(change.get("provider") or "").strip().lower()
    style_id = str(change.get("style_id")) if change.get("style_id") is not None else None
    adjustment = int(change.get("proposed_adjustment") or 0)
    delta = change.get("proposed_runtime_delta") if isinstance(change.get("proposed_runtime_delta"), dict) else {}
    pre_change = _current_policy_snapshot(provider, style_id)
    post_change = _bounded_post_change(pre_change, delta, adjustment)

    auth_hash = hashlib.sha256(body.production_authorization.encode("utf-8")).hexdigest() if body.production_authorization else None
    rollout = await _service_insert(
        "ai_film_policy_promotion_rollouts",
        {
            "change_request_id": change_request_id,
            "review_id": review["id"],
            "owner_id": change["owner_id"],
            "executor_id": caller.id,
            "environment": body.environment,
            "authorization_token_hash": auth_hash,
            "pre_change_config": pre_change,
            "approved_delta": {"adjustment": adjustment, "runtime_delta": delta},
            "post_change_config": post_change,
            "rollback_config": pre_change,
            "status": "validated",
            "runtime_changed": False,
        },
    )
    return {
        "status": "rollout_validated",
        "rollout": rollout,
        "runtime_changed": False,
        "production_applied": False,
        "rollback_ready": True,
    }
