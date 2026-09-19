from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from backend.hermes.dependencies import HermesDependencies
from backend.hermes.proactivity import (
    AutonomyLevel,
    ProactivityPolicy,
    ProactivityService,
    RiskLevel,
    analyze_tasks,
)
from backend.hermes.testing import (
    FrozenClock,
    InMemoryAgentDispatcher,
    InMemoryEventSink,
    InMemoryTaskRepository,
)


def run(coro):
    return asyncio.run(coro)


def build_runtime(now: datetime):
    repository = InMemoryTaskRepository()
    dispatcher = InMemoryAgentDispatcher()
    events = InMemoryEventSink()
    clock = FrozenClock(now)
    dependencies = HermesDependencies(
        repository=repository,
        dispatcher=dispatcher,
        event_sink=events,
        clock=clock,
    )
    return dependencies, repository, dispatcher, events


def test_analyze_detects_stalled_failed_aged_and_duplicates():
    now = datetime(2026, 9, 19, 20, 0, tzinfo=timezone.utc)
    old = (now - timedelta(hours=2)).isoformat()
    tasks = [
        {
            "id": "run-1",
            "title": "Deploy Preview",
            "task_type": "deploy",
            "status": "RUNNING",
            "started_at": old,
        },
        {
            "id": "fail-1",
            "title": "Sync CRM",
            "task_type": "integration",
            "status": "FAILED",
            "created_at": old,
            "error_message": "timeout",
        },
        {
            "id": "pending-1",
            "title": "Prepare report",
            "task_type": "report",
            "status": "PENDING",
            "created_at": old,
        },
        {
            "id": "dup-1",
            "title": "Customer follow up",
            "task_type": "outreach",
            "status": "PENDING",
            "created_at": now.isoformat(),
        },
        {
            "id": "dup-2",
            "title": "  customer   follow up ",
            "task_type": "outreach",
            "status": "PAUSED",
            "created_at": now.isoformat(),
        },
    ]
    policy = ProactivityPolicy(
        stale_running_seconds=1800,
        aged_pending_seconds=3600,
    )

    snapshot, candidates = analyze_tasks(tasks, now=now, policy=policy)

    assert snapshot.stalled_running == 1
    assert snapshot.failed == 1
    assert snapshot.aged_pending == 1
    assert snapshot.duplicate_groups == 1
    assert {candidate.kind for candidate in candidates} == {
        "investigate_stalled_task",
        "review_failed_task",
        "review_aged_pending_task",
        "review_possible_duplicate_work",
    }
    stalled = next(
        item for item in candidates if item.kind == "investigate_stalled_task"
    )
    assert stalled.risk is RiskLevel.HIGH
    assert stalled.requires_approval is True


def test_cycle_persists_manual_review_proposals_idempotently_and_never_dispatches():
    now = datetime(2026, 9, 19, 20, 0, tzinfo=timezone.utc)
    dependencies, repository, dispatcher, events = build_runtime(now)
    repository.tables["hermes_tasks"] = [
        {
            "id": "failed-task",
            "title": "Important task",
            "task_type": "generic",
            "status": "FAILED",
            "created_at": (now - timedelta(minutes=10)).isoformat(),
            "retry_count": 1,
        }
    ]
    service = ProactivityService(
        dependencies,
        ProactivityPolicy(autonomy_level=AutonomyLevel.A1_RECOMMEND),
    )

    first = run(service.run_cycle(persist_proposals=True))
    second = run(service.run_cycle(persist_proposals=True))

    proposals = [
        row
        for row in repository.tables["hermes_tasks"]
        if row.get("task_type") == "proactive_proposal"
    ]
    assert len(first.created_proposal_ids) == 1
    assert len(second.created_proposal_ids) == 0
    assert len(second.existing_proposal_ids) == 1
    assert len(proposals) == 1
    assert proposals[0]["status"] == "MANUAL_REVIEW"
    assert proposals[0]["source"] == "hermes_watchtower"
    assert proposals[0]["input_data"]["execution_policy"] == "proposal_only_no_dispatch"
    assert dispatcher.calls == []
    assert any(
        event["event"] == "watchtower.proposal.created" for event in events.events
    )


def test_a0_observe_mode_never_persists_even_when_requested():
    now = datetime(2026, 9, 19, 20, 0, tzinfo=timezone.utc)
    dependencies, repository, dispatcher, _ = build_runtime(now)
    repository.tables["hermes_tasks"] = [
        {
            "id": "failed-task",
            "title": "Failed",
            "task_type": "generic",
            "status": "FAILED",
            "created_at": now.isoformat(),
        }
    ]
    service = ProactivityService(
        dependencies,
        ProactivityPolicy(autonomy_level=AutonomyLevel.A0_OBSERVE),
    )

    result = run(service.run_cycle(persist_proposals=True))

    assert result.dry_run is True
    assert result.candidates
    assert [
        row
        for row in repository.tables["hermes_tasks"]
        if row.get("task_type") == "proactive_proposal"
    ] == []
    assert dispatcher.calls == []
