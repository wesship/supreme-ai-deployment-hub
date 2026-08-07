import asyncio

from backend.ai_films.bootstrap_supervisor import run_sovereign_signal_bootstrap_supervisor


def test_supervisor_retries_stale_in_progress_claim_until_bootstrap_runs():
    results = iter(
        [
            {
                "status": "skipped",
                "reason": "project_not_claimable",
                "state": "in_progress",
            },
            {"status": "complete", "ready": 15, "skipped": 0, "failed": 0, "total": 15},
        ]
    )
    sleeps = []

    async def bootstrap():
        return next(results)

    async def sleep(seconds):
        sleeps.append(seconds)

    result = asyncio.run(
        run_sovereign_signal_bootstrap_supervisor(
            bootstrap=bootstrap,
            sleep=sleep,
            poll_seconds=2,
            max_wait_seconds=10,
        )
    )

    assert result["status"] == "complete"
    assert sleeps == [2]


def test_supervisor_does_not_retry_terminal_skip():
    calls = 0

    async def bootstrap():
        nonlocal calls
        calls += 1
        return {
            "status": "skipped",
            "reason": "project_not_claimable",
            "state": "complete",
        }

    async def sleep(_seconds):
        raise AssertionError("sleep should not be called")

    result = asyncio.run(
        run_sovereign_signal_bootstrap_supervisor(
            bootstrap=bootstrap,
            sleep=sleep,
            poll_seconds=1,
            max_wait_seconds=10,
        )
    )

    assert result["state"] == "complete"
    assert calls == 1


def test_supervisor_stops_after_wait_budget():
    calls = 0
    sleeps = []

    async def bootstrap():
        nonlocal calls
        calls += 1
        return {
            "status": "skipped",
            "reason": "project_not_claimable",
            "state": "in_progress",
        }

    async def sleep(seconds):
        sleeps.append(seconds)

    result = asyncio.run(
        run_sovereign_signal_bootstrap_supervisor(
            bootstrap=bootstrap,
            sleep=sleep,
            poll_seconds=3,
            max_wait_seconds=5,
        )
    )

    assert result["reason"] == "stale_claim_wait_exhausted"
    assert result["waited_seconds"] == 3
    assert calls == 2
    assert sleeps == [3]
