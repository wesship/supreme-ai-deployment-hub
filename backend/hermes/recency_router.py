"""Authenticated Hermes repository-recency acknowledgement API."""

from __future__ import annotations

import hmac
import os
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from backend.hermes.contracts import TaskStatus
from backend.hermes.task_engine import (
    create_task,
    get_task_by_correlation_id,
    transition_task,
)

router = APIRouter(prefix="/api/hermes/recency", tags=["hermes-recency"])


class RecencyAcknowledgement(BaseModel):
    model_config = ConfigDict(extra="forbid")

    commit_sha: str = Field(..., min_length=7, max_length=64, pattern=r"^[0-9a-fA-F]+$")
    canonical_context_version: str = Field(..., min_length=1, max_length=100)
    canonical_context_sha256: str = Field(..., pattern=r"^[0-9a-fA-F]{64}$")
    verification_status: Literal["VERIFIED", "MISMATCH"]
    source: str = Field(default="github_actions", min_length=1, max_length=100)
    verification_report: dict[str, Any] = Field(default_factory=dict)


def require_recency_write_token(
    token: Annotated[str | None, Header(alias="X-Hermes-Recency-Token")] = None,
) -> None:
    """Require the dedicated machine credential without exposing OCC user tokens."""
    expected = os.getenv("HERMES_RECENCY_WRITE_TOKEN", "")
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Hermes recency write-back is not configured.",
        )
    if not token or not hmac.compare_digest(token, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Hermes recency write token.",
        )


async def _advance_acknowledgement_task(
    task: dict[str, Any],
    target_status: TaskStatus,
    output_data: dict[str, Any],
) -> dict[str, Any]:
    current = TaskStatus(task["status"])
    if current is target_status:
        return task
    if current is TaskStatus.PENDING:
        task = await transition_task(task["id"], TaskStatus.LOCKED, agent_name="Hermes")
        current = TaskStatus(task["status"])
    if current is TaskStatus.LOCKED:
        task = await transition_task(task["id"], TaskStatus.RUNNING, agent_name="Hermes")
        current = TaskStatus(task["status"])
    if current is TaskStatus.RUNNING:
        return await transition_task(
            task["id"],
            target_status,
            output_data=output_data,
            agent_name="Hermes",
        )
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=f"Recency acknowledgement task is in incompatible state {current.value}.",
    )


@router.post("/acknowledge")
async def acknowledge_recency(
    body: RecencyAcknowledgement,
    token: Annotated[str | None, Header(alias="X-Hermes-Recency-Token")] = None,
) -> dict[str, Any]:
    """Persist an idempotent, auditable acknowledgement in Hermes tasks/events."""
    require_recency_write_token(token)
    correlation_id = f"repo-recency:{body.commit_sha.lower()}:{body.canonical_context_sha256.lower()}"
    task = await get_task_by_correlation_id(correlation_id)
    created = task is None

    payload = body.model_dump()
    if task is None:
        task = await create_task(
            title=f"Repository recency acknowledgement {body.commit_sha[:12]}",
            task_type="repo_recency",
            description="Audit the canonical AI context served by the deployed Knowledge API.",
            agent_name="Hermes",
            input_data=payload,
            priority=8,
            source=body.source,
            correlation_id=correlation_id,
        )

    target_status = (
        TaskStatus.COMPLETED
        if body.verification_status == "VERIFIED"
        else TaskStatus.MANUAL_REVIEW
    )
    task = await _advance_acknowledgement_task(
        task,
        target_status,
        {
            "verification_status": body.verification_status,
            "canonical_context_version": body.canonical_context_version,
            "canonical_context_sha256": body.canonical_context_sha256.lower(),
            "verification_report": body.verification_report,
        },
    )
    return {
        "acknowledged": True,
        "created": created,
        "idempotent": not created,
        "correlation_id": correlation_id,
        "task": task,
    }
