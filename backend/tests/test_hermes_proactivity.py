from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

import httpx

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


def test_future_scheduled_pending_task_is_not_aged():
    now = datetime(2026, 9, 19, 20, 0, tzinfo=timezone.utc)
    tasks = [
        {
            "id": "future-task",
            "title": "Future task",
            "task_type": "generic",
            "status": "PENDING",
            "created_at": (now - timedelta(days=1)).isoformat(),
            "scheduled_at": (now + timedelta(hours=2)).isoformat(),
        }
    ]
    snapshot, candidates = analyze_tasks(
        tasks,
        now=now,
        policy=ProactivityPolicy(aged_pending_seconds=3600),
    )

    assert snapshot.aged_pending == 0
    assert all(
        candidate.kind != "review_aged_pending_task" for candidate in candidates
    )


def test_cycle_scans_actionable_statuses_even_when_newer_completed_rows_dominate():
    now = datetime(2026, 9, 19, 20, 0, tzinfo=timezone.utc)
    dependencies, repository, _, _ = build_runtime(now)
    repository.tables["hermes_tasks"] = [
        {
            "id": f"done-{index}",
            "title": f"Completed {index}",
            "task_type": "generic",
            "status": "COMPLETED",
            "created_at": (now - timedelta(minutes=index)).isoformat(),
        }
        for index in range(20)
    ]
    repository.tables["hermes_tasks"].append(
        {
            "id": "older-failed",
            "title": "Older failed task",
            "task_type": "generic",
            "status": "FAILED",
            "created_at": (now - timedelta(days=2)).isoformat(),
        }
    )
    service = ProactivityService(
        dependencies,
        ProactivityPolicy(max_scan_tasks=10),
    )

    result = run(service.run_cycle(persist_proposals=False))

    assert any(
        candidate.kind == "review_failed_task"
        and "older-failed" in candidate.target_task_ids
        for candidate in result.candidates
    )


def test_proposal_cap_progresses_past_existing_candidates():
    now = datetime(2026, 9, 19, 20, 0, tzinfo=timezone.utc)
    dependencies, repository, dispatcher, _ = build_runtime(now)
    repository.tables["hermes_tasks"] = [
        {
            "id": f"failed-{index}",
            "title": f"Failed task {index}",
            "task_type": "generic",
            "status": "FAILED",
            "created_at": (now - timedelta(minutes=index + 1)).isoformat(),
        }
        for index in range(3)
    ]
    service = ProactivityService(
        dependencies,
        ProactivityPolicy(
            autonomy_level=AutonomyLevel.A1_RECOMMEND,
            max_proposals_per_cycle=1,
        ),
    )

    first = run(service.run_cycle(persist_proposals=True))
    second = run(service.run_cycle(persist_proposals=True))

    proposals = [
        row
        for row in repository.tables["hermes_tasks"]
        if row.get("task_type") == "proactive_proposal"
    ]
    assert len(first.created_proposal_ids) == 1
    assert len(second.created_proposal_ids) == 1
    assert len(proposals) == 2
    assert dispatcher.calls == []


def test_status_backlog_advances_across_cycles_without_dispatch():
    now = datetime(2026, 9, 19, 20, 0, tzinfo=timezone.utc)
    dependencies, repository, dispatcher, _ = build_runtime(now)
    repository.tables["hermes_tasks"] = [
        {
            "id": f"failed-{index}",
            "title": f"Failed task {index}",
            "task_type": "generic",
            "status": "FAILED",
            "created_at": (now - timedelta(minutes=30 - index)).isoformat(),
        }
        for index in range(25)
    ]
    service = ProactivityService(dependencies, ProactivityPolicy(max_scan_tasks=10))

    seen = set()
    for _ in range(3):
        result = run(service.run_cycle(persist_proposals=False))
        seen.update(target for candidate in result.candidates for target in candidate.target_task_ids)

    assert len(seen) == 25
    assert dispatcher.calls == []


def test_concurrent_correlation_conflict_recovers_existing_proposal():
    now = datetime(2026, 9, 19, 20, 0, tzinfo=timezone.utc)
    dependencies, repository, dispatcher, events = build_runtime(now)
    repository.tables["hermes_tasks"] = [{
        "id": "failed-task", "title": "Failed", "task_type": "generic",
        "status": "FAILED", "created_at": now.isoformat(),
    }]
    original_create = repository.create_row

    async def racing_create(table, payload):
        await original_create(table, payload)
        request = httpx.Request("POST", "https://example.test/rest/v1/hermes_tasks")
        response = httpx.Response(409, json={"code": "23505"}, request=request)
        raise httpx.HTTPStatusError("duplicate correlation", request=request, response=response)

    repository.create_row = racing_create
    result = run(ProactivityService(dependencies).run_cycle())

    assert len(result.existing_proposal_ids) == 1
    assert result.created_proposal_ids == []
    assert len([row for row in repository.tables["hermes_tasks"] if row.get("task_type") == "proactive_proposal"]) == 1
    assert dispatcher.calls == []
    assert not any(event["event"] == "watchtower.proposal.created" for event in events.events)
