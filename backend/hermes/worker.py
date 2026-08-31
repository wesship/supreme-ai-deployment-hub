"""Hermes persistent background worker.

This long-running worker intentionally does not expose an HTTP listener; its Railway
service configuration must therefore omit an HTTP health-check path.

The worker obtains every new task through PostgreSQL's atomic claim RPC. Durable
worker registration, heartbeats, leases, and restart recovery are required for
execution; the legacy REST list-then-claim path is intentionally unavailable.
"""
from __future__ import annotations

import asyncio
import logging
import os
import signal
from typing import Any

from backend.hermes.dependencies import get_dependencies
from backend.hermes.worker_runtime import (
    PersistentWorkerRuntime,
    build_persistent_worker_runtime,
)
from backend.hermes.workflows.workers import WorkerLease
from backend.hermes.task_engine import (
    TaskTransitionConflict,
    dispatch_to_agent,
    get_task,
    log_event,
    transition_task,
)

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("hermes.worker")

DEFAULT_AGENT = os.getenv("HERMES_DEFAULT_AGENT", "TARS")
POLL_INTERVAL_SECONDS = float(os.getenv("HERMES_POLL_INTERVAL_SECONDS", "10"))
MAX_TASKS_PER_TICK = int(os.getenv("HERMES_MAX_TASKS_PER_TICK", "5"))
EXTERNAL_COORDINATOR_AGENTS = frozenset({"ai-films-mastering"})

_stop_event = asyncio.Event()


def _handle_shutdown(signum: int, _frame: Any) -> None:
    logger.info("received shutdown signal %s", signum)
    _stop_event.set()


async def _release_lease_safely(
    runtime: PersistentWorkerRuntime,
    lease: WorkerLease,
    *,
    cancelled: bool,
) -> None:
    try:
        await runtime.release(lease.lease_id, cancelled=cancelled)
    except Exception as exc:  # noqa: BLE001
        logger.exception("failed to release task lease id=%s: %s", lease.lease_id, exc)
        await log_event(
            event="hermes.worker.lease_release_failed",
            task_id=lease.task_id,
            agent_name="HERMES",
            level="error",
            message=str(exc),
            data={"lease_id": lease.lease_id, "worker_id": runtime.worker_id},
        )


async def _process_task(
    task: dict[str, Any],
    runtime: PersistentWorkerRuntime,
    recovered_lease: WorkerLease | None = None,
) -> None:
    task_id = task.get("id")
    if not task_id:
        logger.warning("skipping task without id: %s", task)
        return

    agent_name = task.get("agent_name") or DEFAULT_AGENT
    status = str(task.get("status") or "PENDING")
    if status == "PENDING" and str(agent_name).strip().lower() in EXTERNAL_COORDINATOR_AGENTS:
        logger.debug("leaving external coordinator task pending id=%s agent=%s", task_id, agent_name)
        return

    lease = recovered_lease
    if lease is None:
        raise RuntimeError("atomic Hermes task processing requires an acquired database lease")

    input_data = task.get("input_data") or {}
    completed = False

    logger.info("processing task id=%s agent=%s", task_id, agent_name)

    try:
        if status == "LOCKED":
            await transition_task(task_id, "RUNNING", agent_name=agent_name)
            status = "RUNNING"
        if status != "RUNNING":
            logger.info("skipping non-runnable task id=%s status=%s", task_id, status)
            return

        result = await dispatch_to_agent(
            agent_name=agent_name,
            task_id=task_id,
            input_data=input_data,
            idempotency_key=f"hermes-task:{task_id}",
        )

        await transition_task(
            task_id,
            "COMPLETED",
            output_data={"dispatch_result": result},
            agent_name=agent_name,
        )
        completed = True
        logger.info("completed task id=%s agent=%s", task_id, agent_name)

    except TaskTransitionConflict:
        logger.info("task claim lost id=%s; another worker already claimed it", task_id)
        return
    except Exception as exc:  # noqa: BLE001
        logger.exception("task failed id=%s", task_id)
        try:
            await transition_task(
                task_id,
                "FAILED",
                error_message=str(exc),
                agent_name=agent_name,
            )
        except Exception as transition_exc:  # noqa: BLE001
            logger.exception("failed to mark task failed id=%s: %s", task_id, transition_exc)
            await log_event(
                event="hermes.worker.transition_failed",
                task_id=task_id,
                agent_name=agent_name,
                level="error",
                message=str(transition_exc),
                data={"original_error": str(exc)},
            )
    finally:
        await _release_lease_safely(
            runtime,
            lease,
            cancelled=not completed,
        )


async def _recover_leased_tasks(runtime: PersistentWorkerRuntime) -> None:
    for lease in runtime.recoverable_leases():
        task = await get_task(lease.task_id)
        if task is None:
            await _release_lease_safely(runtime, lease, cancelled=True)
            continue
        await _process_task(task, runtime=runtime, recovered_lease=lease)


async def run_worker() -> None:
    dependencies = get_dependencies()
    runtime = build_persistent_worker_runtime(
        repository=dependencies.repository,
        clock=dependencies.clock,
    )
    if not runtime.config.enabled:
        raise RuntimeError(
            "HERMES_PERSISTENT_WORKERS_ENABLED must remain enabled; non-atomic worker polling is disabled"
        )
    await runtime.start()
    await _recover_leased_tasks(runtime)

    logger.info(
        "Hermes worker starting poll_interval=%ss max_tasks_per_tick=%s "
        "default_agent=%s persistent_workers=true worker_id=%s",
        POLL_INTERVAL_SECONDS,
        MAX_TASKS_PER_TICK,
        DEFAULT_AGENT,
        runtime.worker_id,
    )
    await log_event(
        event="hermes.worker.started",
        message="Hermes worker started",
        agent_name="HERMES",
        data={
            "poll_interval_seconds": POLL_INTERVAL_SECONDS,
            "max_tasks_per_tick": MAX_TASKS_PER_TICK,
            "default_agent": DEFAULT_AGENT,
            "persistent_workers": True,
            "worker_id": runtime.worker_id,
        },
    )

    try:
        while not _stop_event.is_set():
            try:
                await runtime.heartbeat()
                claimed_count = 0
                for _ in range(MAX_TASKS_PER_TICK):
                    if _stop_event.is_set():
                        break
                    claim = await runtime.claim_next_task()
                    if claim is None:
                        break
                    claimed_count += 1
                    await _process_task(
                        claim.task,
                        runtime=runtime,
                        recovered_lease=claim.lease,
                    )
                if claimed_count == 0:
                    logger.debug("no eligible Hermes tasks available for atomic claim")
            except Exception as exc:  # noqa: BLE001
                logger.exception("Hermes worker tick failed: %s", exc)
                await log_event(
                    event="hermes.worker.tick_failed",
                    message=str(exc),
                    agent_name="HERMES",
                    level="error",
                )

            try:
                await asyncio.wait_for(_stop_event.wait(), timeout=POLL_INTERVAL_SECONDS)
            except asyncio.TimeoutError:
                continue
    finally:
        await runtime.stop()

    await log_event(
        event="hermes.worker.stopped",
        message="Hermes worker stopped",
        agent_name="HERMES",
    )
    logger.info("Hermes worker stopped")


def main() -> None:
    signal.signal(signal.SIGTERM, _handle_shutdown)
    signal.signal(signal.SIGINT, _handle_shutdown)
    asyncio.run(run_worker())


if __name__ == "__main__":
    main()
