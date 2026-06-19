"""
DevonnBench v1 — Benchmark Runner

Submits benchmark cases to a Devonn API environment, evaluates assertions,
and produces a machine-readable JSON artifact.
"""
from __future__ import annotations

import asyncio
import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

import httpx
import yaml

from .assertions import evaluate_assertion
from .models import (
    AssertionType,
    BenchmarkCase,
    BenchmarkRunResult,
    BenchmarkSuite,
    CaseResult,
    CriticalFailureReason,
)
from .scoring import evaluate_run


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_suite(path: str | Path) -> BenchmarkSuite:
    with open(path) as f:
        data = yaml.safe_load(f)
    return BenchmarkSuite(**data)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _excerpt(text: str, max_chars: int = 500) -> str:
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "…"


# ---------------------------------------------------------------------------
# Per-case execution
# ---------------------------------------------------------------------------

async def _run_case(
    case: BenchmarkCase,
    base_url: str,
    client: httpx.AsyncClient,
    env_headers: Dict[str, str],
) -> CaseResult:
    if case.skip:
        reason = case.skip_reason or "Case explicitly skipped"
        return CaseResult(
            case_id=case.id,
            case_name=case.name,
            category=case.category,
            passed=False,
            score=0.0,
            skipped=True,
            skip_reason=reason,
            execution_error=f"SKIPPED: {reason}",
        )

    url = base_url.rstrip("/") + case.endpoint
    headers = {**env_headers, **case.headers}
    http_status: Optional[int] = None
    response_body: Optional[str] = None
    response_json = None
    latency_ms = 0.0
    execution_error: Optional[str] = None

    try:
        t0 = time.perf_counter()
        response = await client.request(
            method=case.method.upper(),
            url=url,
            headers=headers,
            json=case.body,
            timeout=30.0,
        )
        latency_ms = (time.perf_counter() - t0) * 1000
        http_status = response.status_code
        response_body = response.text
        try:
            response_json = response.json()
        except Exception:
            response_json = None
    except Exception as exc:
        execution_error = str(exc)

    # Evaluate assertions
    assertion_results = [
        evaluate_assertion(
            a,
            http_status=http_status,
            response_body=response_body,
            response_json=response_json,
            latency_ms=latency_ms,
        )
        for a in case.assertions
    ]

    # Determine critical failure. A failed CRITICAL_SAFETY assertion is critical.
    # For content-based safety cases, a CRITICAL_SAFETY assertion can also act as
    # the case-level critical marker: if any other assertion in the same case fails,
    # the marker's critical_failure reason is surfaced for release gating.
    critical_failure: Optional[CriticalFailureReason] = None
    critical_markers = [
        ar.assertion.critical_failure
        for ar in assertion_results
        if ar.assertion.type == AssertionType.CRITICAL_SAFETY and ar.assertion.critical_failure
    ]
    for ar in assertion_results:
        if (
            not ar.passed
            and ar.assertion.type == AssertionType.CRITICAL_SAFETY
            and ar.assertion.critical_failure
        ):
            critical_failure = ar.assertion.critical_failure
            break
    if critical_failure is None and critical_markers and any(not ar.passed for ar in assertion_results):
        critical_failure = critical_markers[0]

    all_passed = all(ar.passed for ar in assertion_results) and execution_error is None
    # Score: fraction of assertions that passed (critical failure → 0)
    if critical_failure:
        score = 0.0
        passed = False
    elif not assertion_results:
        # No assertions defined — pass/fail based on HTTP 2xx
        score = 1.0 if (http_status and 200 <= http_status < 300) else 0.0
        passed = bool(score)
    else:
        score = sum(1 for ar in assertion_results if ar.passed) / len(assertion_results)
        passed = all_passed

    return CaseResult(
        case_id=case.id,
        case_name=case.name,
        category=case.category,
        passed=passed,
        score=score,
        http_status=http_status,
        latency_ms=round(latency_ms, 2),
        assertion_results=assertion_results,
        critical_failure=critical_failure,
        response_excerpt=_excerpt(response_body or ""),
        execution_error=execution_error,
    )


# ---------------------------------------------------------------------------
# Suite runner
# ---------------------------------------------------------------------------

async def run_suite(
    suite: BenchmarkSuite,
    base_url: str,
    *,
    environment: str = "unknown",
    devonn_version: Optional[str] = None,
    git_commit: Optional[str] = None,
    threshold: float = 80.0,
    auth_token: Optional[str] = None,
    concurrency: int = 5,
    output_dir: str = "benchmark-artifacts",
) -> BenchmarkRunResult:
    run_id = str(uuid.uuid4())
    started_at = _now_iso()
    t_start = time.perf_counter()

    env_headers: Dict[str, str] = {}
    if auth_token:
        env_headers["Authorization"] = f"Bearer {auth_token}"

    async with httpx.AsyncClient() as client:
        sem = asyncio.Semaphore(concurrency)

        async def bounded_run(case: BenchmarkCase) -> CaseResult:
            async with sem:
                return await _run_case(case, base_url, client, env_headers)

        tasks = [bounded_run(c) for c in suite.cases]
        case_results: List[CaseResult] = await asyncio.gather(*tasks)

    duration = time.perf_counter() - t_start
    finished_at = _now_iso()

    overall_score, passed, category_scores, critical_failures = evaluate_run(
        case_results, threshold=threshold
    )

    eligible_results = [r for r in case_results if not r.skipped]
    total_latency = sum(r.latency_ms or 0 for r in eligible_results)
    total_cost = sum(r.estimated_cost_usd or 0 for r in eligible_results)
    skipped = len(case_results) - len(eligible_results)
    passed_cases = sum(1 for r in eligible_results if r.passed)
    failed_cases = len(eligible_results) - passed_cases

    result = BenchmarkRunResult(
        run_id=run_id,
        suite_name=suite.name,
        suite_version=suite.version,
        devonn_version=devonn_version or os.getenv("DEVONN_VERSION"),
        git_commit=git_commit or os.getenv("GITHUB_SHA"),
        environment=environment,
        base_url=base_url,
        overall_score=overall_score,
        passed=passed,
        critical_failures=critical_failures,
        category_scores=category_scores,
        case_results=case_results,
        total_cases=len(case_results),
        executed_cases=len(eligible_results),
        passed_cases=passed_cases,
        failed_cases=failed_cases,
        skipped_cases=skipped,
        total_latency_ms=round(total_latency, 2),
        estimated_total_cost_usd=round(total_cost, 6),
        threshold=threshold,
        started_at=started_at,
        finished_at=finished_at,
        duration_seconds=round(duration, 3),
    )

    # Write artifact
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    artifact_path = f"{output_dir}/{run_id}.json"
    with open(artifact_path, "w") as f:
        f.write(result.model_dump_json(indent=2))
    result.artifact_path = artifact_path

    return result


def run_suite_sync(suite_path: str, base_url: str, **kwargs) -> BenchmarkRunResult:
    """Synchronous entry point for CLI use."""
    suite = _load_suite(suite_path)
    if not suite.base_url:
        suite.base_url = base_url
    return asyncio.run(run_suite(suite, base_url, **kwargs))
