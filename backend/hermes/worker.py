"""Hermes task polling worker.

This module turns the Hermes container into a long-running orchestrator loop.
It polls Supabase-backed Hermes tasks, claims pending work, marks it running,
dispatches it to the selected agent, and records the final state.

It intentionally uses the existing task_engine helpers so it works with the
current Hermes REST/Supabase integration and remains safe if Supabase is not
configured.
"""
from __future__ import annotations

import asyncio
import logging
import os
import signal
from typing import Any

from hermes.task_engine import (
    dispatch_to_agent,
    list_tasks,
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

_stop_event = asyncio.Event()


def _handle_shutdown(signum: int, _frame: Any) -> None:
    logger.info("received shutdown signal %s", signum)
    _stop_event.set()


async def _process_task(task: dict[str, Any]) -> None:
    task_id = task.get("id")
    if not task_id:
        logger.warning("skipping task without id: %s", task)
        return

    agent_name = task.get("agent_name") or DEFAULT_AGENT
    input_data = task.get("input_data") or {}

    logger.info("claiming task id=%s agent=%s", task_id, agent_name)

    try:
        await transition_task(task_id, "LOCKED", agent_name=agent_name)
        await transition_task(task_id, "RUNNING", agent_name=agent_name)

        result = await dispatch_to_agent(
            agent_name=agent_name,
            task_id=task_id,
            input_data=input_data,
        )

        await transition_task(
            task_id,
            "COMPLETED",
            output_data={"dispatch_result": result},
            agent_name=agent_name,
        )
        logger.info("completed task id=%s agent=%s", task_id, agent_name)

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


async def run_worker() -> None:
    logger.info(
        "Hermes worker starting poll_interval=%ss max_tasks_per_tick=%s default_agent=%s",
        POLL_INTERVAL_SECONDS,
        MAX_TASKS_PER_TICK,
        DEFAULT_AGENT,
    )
    await log_event(
        event="hermes.worker.started",
        message="Hermes worker started",
        agent_name="HERMES",
        data={
            "poll_interval_seconds": POLL_INTERVAL_SECONDS,
            "max_tasks_per_tick": MAX_TASKS_PER_TICK,
            "default_agent": DEFAULT_AGENT,
        },
    )

    while not _stop_event.is_set():
        try:
            tasks = await list_tasks(status="PENDING", limit=MAX_TASKS_PER_TICK)
            if not tasks:
                logger.debug("no pending Hermes tasks")
            for task in tasks:
                if _stop_event.is_set():
                    break
                await _process_task(task)
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
