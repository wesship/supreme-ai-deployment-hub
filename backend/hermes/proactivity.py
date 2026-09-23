"""Hermes Proactivity Engine and Watchtower.

This module turns Hermes from a purely reactive task engine into a bounded,
auditable observation loop. Version 1 intentionally never dispatches the
actions it discovers. It creates idempotent MANUAL_REVIEW proposals only.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import re
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any
from uuid import NAMESPACE_URL, uuid5

import httpx
from pydantic import BaseModel, ConfigDict, Field

from backend.hermes.contracts import TaskStatus
from backend.hermes.dependencies import HermesDependencies, get_dependencies

logger = logging.getLogger(__name__)


class AutonomyLevel(StrEnum):
    A0_OBSERVE = "A0"
    A1_RECOMMEND = "A1"
    A2_DRAFT = "A2"
    A3_REVERSIBLE = "A3"
    A4_GUARDED = "A4"
    A5_DOMAIN_AUTONOMOUS = "A5"


class RiskLevel(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


WATCHTOWER_SCAN_STATUSES = (
    TaskStatus.RUNNING.value,
    TaskStatus.FAILED.value,
    TaskStatus.PENDING.value,
    TaskStatus.LOCKED.value,
    TaskStatus.PAUSED.value,
    TaskStatus.MANUAL_REVIEW.value,
)


class ProactivityPolicy(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    autonomy_level: AutonomyLevel = AutonomyLevel.A1_RECOMMEND
    stale_running_seconds: int = Field(default=1_800, ge=300, le=86_400)
    aged_pending_seconds: int = Field(default=3_600, ge=300, le=604_800)
    max_scan_tasks: int = Field(default=200, ge=10, le=1_000)
    max_proposals_per_cycle: int = Field(default=25, ge=1, le=100)


class CandidateAction(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    fingerprint: str
    correlation_id: str
    kind: str
    title: str
    risk: RiskLevel
    requires_approval: bool
    target_task_ids: tuple[str, ...]
    rationale: str
    recommended_action: str
    evidence: dict[str, Any] = Field(default_factory=dict)


class WatchtowerSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    observed_at: str
    scanned_tasks: int
    status_counts: dict[str, int]
    stalled_running: int
    failed: int
    aged_pending: int
    duplicate_groups: int


class ProactivityCycleResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    configured: bool
    execution_mode: str = "proposal_only_no_dispatch"
    autonomy_level: AutonomyLevel
    snapshot: WatchtowerSnapshot
    candidates: list[CandidateAction]
    created_proposal_ids: list[str] = Field(default_factory=list)
    existing_proposal_ids: list[str] = Field(default_factory=list)
    dry_run: bool = False


def policy_from_env() -> ProactivityPolicy:
    raw_level = os.getenv("HERMES_PROACTIVITY_AUTONOMY_LEVEL", "A1").strip().upper()
    level = next((value for value in AutonomyLevel if value.value == raw_level), AutonomyLevel.A1_RECOMMEND)
    return ProactivityPolicy(
        autonomy_level=level,
        stale_running_seconds=_env_int("HERMES_PROACTIVITY_STALE_SECONDS", 1_800, 300, 86_400),
        aged_pending_seconds=_env_int("HERMES_PROACTIVITY_PENDING_SECONDS", 3_600, 300, 604_800),
        max_scan_tasks=_env_int("HERMES_PROACTIVITY_MAX_SCAN", 200, 10, 1_000),
        max_proposals_per_cycle=_env_int("HERMES_PROACTIVITY_MAX_PROPOSALS", 25, 1, 100),
    )


def _env_int(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        return default
    return max(minimum, min(value, maximum))


def _parse_time(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _age_seconds(task: dict[str, Any], now: datetime, *fields: str) -> float | None:
    for field in fields:
        parsed = _parse_time(task.get(field))
        if parsed is not None:
            return max(0.0, (now - parsed).total_seconds())
    return None


def _normalize_title(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def _candidate(
    *,
    kind: str,
    title: str,
    risk: RiskLevel,
    target_task_ids: list[str],
    rationale: str,
    recommended_action: str,
    evidence: dict[str, Any],
) -> CandidateAction:
    identity = {
        "kind": kind,
        "targets": sorted(str(task_id) for task_id in target_task_ids),
    }
    digest = hashlib.sha256(
        json.dumps(identity, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    return CandidateAction(
        fingerprint=digest,
        correlation_id=str(uuid5(NAMESPACE_URL, f"d3vonn:hermes-proactivity:{digest}")),
        kind=kind,
        title=title,
        risk=risk,
        requires_approval=risk in {RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL},
        target_task_ids=tuple(identity["targets"]),
        rationale=rationale,
        recommended_action=recommended_action,
        evidence=evidence,
    )


def analyze_tasks(
    tasks: list[dict[str, Any]],
    *,
    now: datetime,
    policy: ProactivityPolicy,
) -> tuple[WatchtowerSnapshot, list[CandidateAction]]:
    now = now.astimezone(timezone.utc)
    operational = [
        task for task in tasks if str(task.get("task_type", "")) != "proactive_proposal"
    ]
    status_counts: dict[str, int] = {}
    for task in operational:
        status = str(task.get("status", "UNKNOWN")).upper()
        status_counts[status] = status_counts.get(status, 0) + 1

    candidates: list[CandidateAction] = []
    stalled = 0
    failed = 0
    aged_pending = 0

    for task in operational:
        task_id = str(task.get("id", ""))
        if not task_id:
            continue
        status = str(task.get("status", "")).upper()
        title = str(task.get("title") or task_id)

        if status == TaskStatus.RUNNING.value:
            age = _age_seconds(task, now, "started_at", "updated_at", "created_at")
            if age is not None and age >= policy.stale_running_seconds:
                stalled += 1
                candidates.append(
                    _candidate(
                        kind="investigate_stalled_task",
                        title=f"Watchtower: investigate stalled task — {title}",
                        risk=RiskLevel.HIGH,
                        target_task_ids=[task_id],
                        rationale="A Hermes task has remained RUNNING beyond the configured watchdog threshold.",
                        recommended_action="Inspect the active run/worker lease and either resume safely, pause, or escalate through the existing Hermes controls.",
                        evidence={
                            "status": status,
                            "age_seconds": int(age),
                            "threshold_seconds": policy.stale_running_seconds,
                            "task_type": task.get("task_type"),
                            "agent_name": task.get("agent_name"),
                        },
                    )
                )

        if status == TaskStatus.FAILED.value:
            failed += 1
            candidates.append(
                _candidate(
                    kind="review_failed_task",
                    title=f"Watchtower: review failed task — {title}",
                    risk=RiskLevel.MEDIUM,
                    target_task_ids=[task_id],
                    rationale="A Hermes task is in FAILED state and needs explicit diagnosis before any retry.",
                    recommended_action="Review the failure evidence and retry only through the canonical Hermes transition path when safe.",
                    evidence={
                        "status": status,
                        "retry_count": task.get("retry_count", 0),
                        "error_message": task.get("error_message"),
                        "task_type": task.get("task_type"),
                    },
                )
            )

        if status == TaskStatus.PENDING.value:
            # A future scheduled_at is not yet actionable. Prefer the effective
            # availability time over created_at so deliberately deferred work
            # is not mislabeled as stale.
            age = _age_seconds(task, now, "scheduled_at", "created_at")
            if age is not None and age >= policy.aged_pending_seconds:
                aged_pending += 1
                candidates.append(
                    _candidate(
                        kind="review_aged_pending_task",
                        title=f"Watchtower: review aged pending task — {title}",
                        risk=RiskLevel.LOW,
                        target_task_ids=[task_id],
                        rationale="A pending task has remained unclaimed beyond the configured queue-age threshold.",
                        recommended_action="Confirm the task is still relevant, schedulable, and assigned to a healthy execution path.",
                        evidence={
                            "status": status,
                            "age_seconds": int(age),
                            "threshold_seconds": policy.aged_pending_seconds,
                            "task_type": task.get("task_type"),
                            "priority": task.get("priority"),
                        },
                    )
                )

    active_statuses = {
        TaskStatus.PENDING.value,
        TaskStatus.LOCKED.value,
        TaskStatus.RUNNING.value,
        TaskStatus.PAUSED.value,
        TaskStatus.MANUAL_REVIEW.value,
    }
    duplicate_index: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for task in operational:
        if str(task.get("status", "")).upper() not in active_statuses:
            continue
        key = (
            str(task.get("task_type", "")).strip().lower(),
            _normalize_title(task.get("title")),
        )
        if not key[1]:
            continue
        duplicate_index.setdefault(key, []).append(task)

    duplicate_groups = 0
    for (task_type, normalized_title), rows in duplicate_index.items():
        ids = sorted(str(row.get("id")) for row in rows if row.get("id"))
        if len(ids) < 2:
            continue
        duplicate_groups += 1
        candidates.append(
            _candidate(
                kind="review_possible_duplicate_work",
                title=f"Watchtower: review possible duplicate work — {rows[0].get('title', normalized_title)}",
                risk=RiskLevel.MEDIUM,
                target_task_ids=ids,
                rationale="Multiple active Hermes tasks share the same normalized title and task type.",
                recommended_action="Compare inputs and correlation IDs, then consolidate or cancel only after confirming the tasks are semantically redundant.",
                evidence={
                    "task_type": task_type,
                    "normalized_title": normalized_title,
                    "duplicate_count": len(ids),
                },
            )
        )

    risk_rank = {
        RiskLevel.CRITICAL: 0,
        RiskLevel.HIGH: 1,
        RiskLevel.MEDIUM: 2,
        RiskLevel.LOW: 3,
    }
    candidates.sort(key=lambda item: (risk_rank[item.risk], item.kind, item.fingerprint))

    snapshot = WatchtowerSnapshot(
        observed_at=now.isoformat(),
        scanned_tasks=len(operational),
        status_counts=status_counts,
        stalled_running=stalled,
        failed=failed,
        aged_pending=aged_pending,
        duplicate_groups=duplicate_groups,
    )
    return snapshot, candidates


class ProactivityService:
    def __init__(
        self,
        dependencies: HermesDependencies | None = None,
        policy: ProactivityPolicy | None = None,
    ) -> None:
        self._dependencies_override = dependencies
        self.policy = policy or policy_from_env()
        self._scan_offsets = {status: 0 for status in WATCHTOWER_SCAN_STATUSES}

    @property
    def dependencies(self) -> HermesDependencies:
        return self._dependencies_override or get_dependencies()

    async def run_cycle(self, *, persist_proposals: bool = True) -> ProactivityCycleResult:
        deps = self.dependencies
        repository = deps.repository
        configured = bool(repository.configured)
        if not configured:
            empty = WatchtowerSnapshot(
                observed_at=deps.clock.now().astimezone(timezone.utc).isoformat(),
                scanned_tasks=0,
                status_counts={},
                stalled_running=0,
                failed=0,
                aged_pending=0,
                duplicate_groups=0,
            )
            return ProactivityCycleResult(
                configured=False,
                autonomy_level=self.policy.autonomy_level,
                snapshot=empty,
                candidates=[],
                dry_run=True,
            )

        # Query actionable/active statuses independently so a busy ledger full
        # of newer COMPLETED/CANCELLED/proposal rows cannot permanently hide
        # older stalled or pending work behind one global newest-first limit.
        # Each status query scans one bounded page and advances across cycles.
        rows_by_id: dict[str, dict[str, Any]] = {}
        anonymous_rows: list[dict[str, Any]] = []
        for status in WATCHTOWER_SCAN_STATUSES:
            offset = self._scan_offsets[status]
            status_rows = await repository.list_rows(
                "hermes_tasks",
                {
                    "status": f"eq.{status}",
                    "order": "created_at.asc",
                    "limit": str(self.policy.max_scan_tasks),
                    "offset": str(offset),
                },
            )
            self._scan_offsets[status] = (
                offset + len(status_rows)
                if len(status_rows) == self.policy.max_scan_tasks
                else 0
            )
            for row in status_rows:
                if str(row.get("task_type", "")) == "proactive_proposal":
                    continue
                row_id = str(row.get("id", ""))
                if row_id:
                    rows_by_id[row_id] = row
                else:
                    anonymous_rows.append(row)

        rows = [*rows_by_id.values(), *anonymous_rows]
        snapshot, candidates = analyze_tasks(
            rows,
            now=deps.clock.now(),
            policy=self.policy,
        )

        should_persist = (
            persist_proposals
            and self.policy.autonomy_level is not AutonomyLevel.A0_OBSERVE
        )
        created: list[str] = []
        existing: list[str] = []

        if should_persist:
            for candidate in candidates:
                prior = await repository.list_rows(
                    "hermes_tasks",
                    {"correlation_id": f"eq.{candidate.correlation_id}", "limit": "1"},
                )
                if prior:
                    if prior[0].get("id"):
                        existing.append(str(prior[0]["id"]))
                    continue

                if len(created) >= self.policy.max_proposals_per_cycle:
                    break

                try:
                    proposal = await repository.create_row(
                        "hermes_tasks",
                        {
                            "title": candidate.title,
                            "task_type": "proactive_proposal",
                            "status": TaskStatus.MANUAL_REVIEW.value,
                            "priority": 5,
                            "source": "hermes_watchtower",
                            "correlation_id": candidate.correlation_id,
                            "input_data": {
                                "candidate": candidate.model_dump(mode="json"),
                                "execution_policy": "proposal_only_no_dispatch",
                                "autonomy_level": self.policy.autonomy_level.value,
                            },
                            "description": (
                                f"{candidate.rationale} Recommended next action: "
                                f"{candidate.recommended_action}"
                            ),
                        },
                    )
                except httpx.HTTPStatusError as exc:
                    try:
                        code = exc.response.json().get("code")
                    except (ValueError, AttributeError):
                        code = None
                    if exc.response.status_code != 409 or code != "23505":
                        raise
                    concurrent = await repository.list_rows(
                        "hermes_tasks",
                        {"correlation_id": f"eq.{candidate.correlation_id}", "limit": "1"},
                    )
                    if not concurrent or not concurrent[0].get("id"):
                        raise
                    existing.append(str(concurrent[0]["id"]))
                    continue
                proposal_id = str(proposal.get("id", ""))
                if proposal_id:
                    created.append(proposal_id)
                await self._emit(
                    {
                        "event": "watchtower.proposal.created",
                        "task_id": proposal.get("id"),
                        "correlation_id": candidate.correlation_id,
                        "level": "info",
                        "data": {
                            "kind": candidate.kind,
                            "risk": candidate.risk.value,
                            "requires_approval": candidate.requires_approval,
                            "target_task_ids": list(candidate.target_task_ids),
                            "execution_policy": "proposal_only_no_dispatch",
                        },
                    }
                )

        await self._emit(
            {
                "event": "watchtower.cycle.completed",
                "level": "info",
                "data": {
                    "snapshot": snapshot.model_dump(mode="json"),
                    "candidate_count": len(candidates),
                    "created_proposal_count": len(created),
                    "existing_proposal_count": len(existing),
                    "dry_run": not should_persist,
                    "autonomy_level": self.policy.autonomy_level.value,
                },
            }
        )

        return ProactivityCycleResult(
            configured=True,
            autonomy_level=self.policy.autonomy_level,
            snapshot=snapshot,
            candidates=candidates,
            created_proposal_ids=created,
            existing_proposal_ids=existing,
            dry_run=not should_persist,
        )

    async def _emit(self, payload: dict[str, Any]) -> None:
        try:
            await self.dependencies.event_sink.emit(payload)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Hermes Watchtower event emission failed: %s", exc)


async def run_watchtower_loop() -> None:
    """Run the bounded Watchtower loop when explicitly enabled by environment."""
    interval = _env_int("HERMES_PROACTIVITY_INTERVAL_SECONDS", 300, 60, 86_400)
    logger.info(
        "Hermes Watchtower enabled: interval=%ss autonomy=%s proposal-only=true",
        interval,
        policy_from_env().autonomy_level.value,
    )
    service = ProactivityService()
    while True:
        try:
            await service.run_cycle(persist_proposals=True)
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.exception("Hermes Watchtower cycle failed: %s", exc)
        await asyncio.sleep(interval)
