"""Protected second-review API for AI Films routing-policy promotion requests.

This endpoint records an immutable human review event only. It never mutates
provider configuration, activation state, environment variables, or live routing.
"""
from __future__ import annotations

import os
from typing import Any, Literal

import httpx
from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field

from backend.ai_films.orchestration import OrchestrationError, SupabaseRLSClient

router = APIRouter(prefix="/ai-films/policy-promotions", tags=["ai-films", "policy-governance"])


class PromotionReviewRequest(BaseModel):
    decision: Literal["approved", "rejected"]
    rationale: str = Field(min_length=3, max_length=2000)


def _token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Supabase bearer token required")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Bearer token is empty")
    return token


def _service_config() -> tuple[str, str]:
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not base or not key:
        raise HTTPException(status_code=503, detail="Policy review persistence is not configured")
    return base, key


async def _service_select(table: str, params: dict[str, str]) -> list[dict[str, Any]]:
    base, key = _service_config()
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(f"{base}/rest/v1/{table}", headers=headers, params=params)
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"{table} lookup failed")
    payload = response.json()
    return [row for row in payload if isinstance(row, dict)] if isinstance(payload, list) else []


async def _service_insert(table: str, payload: dict[str, Any]) -> dict[str, Any]:
    base, key = _service_config()
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(f"{base}/rest/v1/{table}", headers=headers, json=payload)
    if response.status_code == 409:
        raise HTTPException(status_code=409, detail="This change request already has a second review")
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="Policy review persistence failed")
    rows = response.json()
    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=502, detail="Policy review persistence returned no record")
    return rows[0]


def _canary_state(change_request: dict[str, Any], decision: str) -> str:
    if decision == "rejected":
        return "not_checked"
    required = str(change_request.get("required_canary_state") or "not_required")
    if required == "not_required":
        return "not_required"
    if required == "passed":
        return "passed"
    raise HTTPException(status_code=409, detail="Required provider canary has not passed")


@router.post("/{change_request_id}/reviews", status_code=status.HTTP_201_CREATED)
async def review_policy_promotion(
    change_request_id: str,
    body: PromotionReviewRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    token = _token(authorization)
    try:
        caller = await SupabaseRLSClient(token).current_user()
    except OrchestrationError as exc:
        raise HTTPException(status_code=401, detail="Authenticated reviewer could not be resolved") from exc

    rows = await _service_select(
        "ai_film_policy_promotion_change_requests",
        {
            "id": f"eq.{change_request_id}",
            "select": "id,owner_id,requestor_id,status,second_review_required,required_canary_provider,required_canary_state",
            "limit": "1",
        },
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Policy promotion change request not found")
    change_request = rows[0]

    if str(change_request.get("status")) != "pending_second_review" or not bool(change_request.get("second_review_required")):
        raise HTTPException(status_code=409, detail="Change request is not eligible for second review")
    if str(change_request.get("requestor_id")) == caller.id:
        raise HTTPException(status_code=403, detail="Original requestor cannot perform the second review")

    canary_state = _canary_state(change_request, body.decision)
    review = await _service_insert(
        "ai_film_policy_promotion_reviews",
        {
            "change_request_id": change_request_id,
            "owner_id": change_request["owner_id"],
            "reviewer_id": caller.id,
            "decision": body.decision,
            "rationale": body.rationale.strip(),
            "canary_state": canary_state,
        },
    )
    return {
        "status": "review_recorded",
        "review": review,
        "promotion_executed": False,
        "routing_changed": False,
    }
