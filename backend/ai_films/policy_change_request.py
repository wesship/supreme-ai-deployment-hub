from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class PolicyChangeRequest:
    approval_id: str
    recommendation_key: str
    evidence_hash: str
    provider: str
    style_id: str | None
    recommendation_action: str
    proposed_adjustment: int
    rollback_plan: str
    required_canary_provider: str | None
    required_canary_state: str
    second_review_required: bool = True
    status: str = "pending_second_review"


def build_policy_change_request(
    *,
    approval: dict[str, Any],
    recommendation: dict[str, Any],
    rollback_plan: str,
) -> PolicyChangeRequest:
    if approval.get("decision") != "approved":
        raise ValueError("only approved recommendation evidence can enter policy review")
    rollback = rollback_plan.strip()
    if len(rollback) < 3:
        raise ValueError("rollback plan is required")
    if len(rollback) > 4000:
        raise ValueError("rollback plan exceeds 4000 characters")

    provider = str(recommendation.get("provider") or "").strip().lower()
    if not provider:
        raise ValueError("provider is required")
    adjustment = int(recommendation.get("proposedAdjustment", 0))
    if adjustment < -5 or adjustment > 5:
        raise ValueError("proposed adjustment must stay within -5..+5")

    canary_required = provider != "pollo"
    return PolicyChangeRequest(
        approval_id=str(approval["id"]),
        recommendation_key=str(recommendation["key"]),
        evidence_hash=str(approval["evidenceHash"]),
        provider=provider,
        style_id=recommendation.get("styleId"),
        recommendation_action=str(recommendation.get("action") or "hold"),
        proposed_adjustment=adjustment,
        rollback_plan=rollback,
        required_canary_provider=provider if canary_required else None,
        required_canary_state="pass_required" if canary_required else "not_required",
    )
