"""Supervise the one-time Sovereign Signal Railway bootstrap across deployment swaps."""

from __future__ import annotations

import asyncio
import os
from collections.abc import Awaitable, Callable
from typing import Any

from backend.ai_films.bootstrap import bootstrap_sovereign_signal_movieflow_ingestion


async def run_sovereign_signal_bootstrap_supervisor(
    *,
    bootstrap: Callable[[], Awaitable[dict[str, Any]]] = bootstrap_sovereign_signal_movieflow_ingestion,
    sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    poll_seconds: float | None = None,
    max_wait_seconds: float | None = None,
) -> dict[str, Any]:
    """Retry only when a deployment starts while another stale claim is still active.

    Railway can replace an instance before the old process has reset its Supabase
    claim. In that narrow race the first bootstrap call returns
    ``project_not_claimable`` with state ``in_progress``. Keep the background
    supervisor alive long enough for the stale-claim reset to run, then call the
    idempotent bootstrap again. Any other result is terminal.
    """
    interval = poll_seconds
    if interval is None:
        interval = float(os.getenv("AI_FILM_BOOTSTRAP_RECLAIM_POLL_SECONDS", "15"))
    wait_budget = max_wait_seconds
    if wait_budget is None:
        wait_budget = float(os.getenv("AI_FILM_BOOTSTRAP_RECLAIM_MAX_WAIT_SECONDS", "600"))

    interval = max(1.0, interval)
    wait_budget = max(0.0, wait_budget)
    elapsed = 0.0

    while True:
        result = await bootstrap()
        blocked_by_stale_claim = (
            result.get("status") == "skipped"
            and result.get("reason") == "project_not_claimable"
            and result.get("state") == "in_progress"
        )
        if not blocked_by_stale_claim:
            return result
        if elapsed + interval > wait_budget:
            return {
                **result,
                "reason": "stale_claim_wait_exhausted",
                "waited_seconds": elapsed,
            }
        await sleep(interval)
        elapsed += interval
