"""DevonnBench async HTTP runner."""
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
from .models import BenchmarkCase, BenchmarkRunResult, BenchmarkSuite, CaseResult, CriticalFailureReason
from .scoring import evaluate_run


def _load_suite(path: str | Path) -> BenchmarkSuite:
    with open(path, encoding="utf-8") as handle:
        return BenchmarkSuite(**yaml.safe_load(handle))


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _excerpt(text: str, max_chars: int = 800) -> str:
    return text if len(text) <= max_chars else text[:max_chars] + "…"


async def _run_case(
    case: BenchmarkCase,
    base_url: str,
    client: httpx.AsyncClient,
    env_headers: Dict[str, str],
) -> CaseResult:
    if case.skip:
        return CaseResult(
            case_id=case.id,
            case_name=case.name,
            category=case.category,
            passed=False,
            score=0.0,
            weight=case.weight,
            skipped=True,
            skip_reason=case.skip_reason or "Case explicitly skipped",
        )

    url = base_url.rstrip("/") + case.endpoint
    headers = {**env_headers, **case.headers}
    http_status: Optional[int] = None
    response_body: Optional[str] = None
    response_json = None
    latency_ms = 0.0
    execution_error: Optional[str] = None

    try:
        started = time.perf_counter()
        response = await client.request(
            method=case.method.upper(),
            url=url,
            headers=headers,
            json=case.body,
            timeout=30.0,
        )
        latency_ms = (time.perf_counter() - started) * 1000
        http_status = response.status_code
        response_body = response.text
        try:
            response_json = response.json()
        except ValueError:
            response_json = None
    except Exception as exc:  # pragma: no cover - network/runtime protection
        execution_error = str(exc)

    assertion_results = [
        evaluate_assertion(
            assertion,
            http_status=http_status,
            response_body=response_body,
            response_json=response_json,
            latency_ms=latency_ms,
        )
        for assertion in case.assertions
    ]

    critical_failure: Optional[CriticalFailureReason] = None
    for result in assertion_results:
        if not result.passed and result.assertion.critical_failure:
            critical_failure = result.assertion.critical_failure
            break

    all_passed = execution_error is None and all(result.passed for result in assertion_results)
    if critical_failure:
        score = 0.0
        passed = False
    elif assertion_results:
        score = sum(1 for result in assertion_results if result.passed) / len(assertion_results)
        passed = all_passed
    else:
        score = 1.0 if http_status and 200 <= http_status < 300 else 0.0
        passed = bool(score)

    return CaseResult(
        case_id=case.id,
        case_name=case.name,
        category=case.category,
        passed=passed,
        score=score,
        weight=case.weight,
        http_status=http_status,
        latency_ms=round(latency_ms, 2),
        assertion_results=assertion_results,
        critical_failure=critical_failure,
        response_excerpt=_excerpt(response_body or ""),
        execution_error=execution_error,
    )


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
    started = time.perf_counter()

    env_headers: Dict[str, str] = {}
    if auth_token:
        env_headers["Authorization"] = f"Bearer {auth_token}"

    async with httpx.AsyncClient() as client:
        semaphore = asyncio.Semaphore(concurrency)

        async def bounded_run(case: BenchmarkCase) -> CaseResult:
            async with semaphore:
                return await _run_case(case, base_url, client, env_headers)

        case_results: List[CaseResult] = await asyncio.gather(*(bounded_run(case) for case in suite.cases))

    overall_score, passed, category_scores, critical_failures, coverage_failures = evaluate_run(
        case_results,
        threshold=threshold,
        required_categories=suite.required_categories,
    )

    eligible_results = [result for result in case_results if not result.skipped]
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
        coverage_failures=coverage_failures,
        category_scores=category_scores,
        case_results=case_results,
        total_cases=len(case_results),
        executed_cases=len(eligible_results),
        passed_cases=sum(1 for item in eligible_results if item.passed),
        failed_cases=sum(1 for item in eligible_results if not item.passed),
        skipped_cases=len(case_results) - len(eligible_results),
        total_latency_ms=round(sum(item.latency_ms or 0 for item in eligible_results), 2),
        estimated_total_cost_usd=round(sum(item.estimated_cost_usd or 0 for item in eligible_results), 6),
        threshold=threshold,
        started_at=started_at,
        finished_at=_now_iso(),
        duration_seconds=round(time.perf_counter() - started, 3),
    )

    Path(output_dir).mkdir(parents=True, exist_ok=True)
    artifact_path = f"{output_dir}/{run_id}.json"
    with open(artifact_path, "w", encoding="utf-8") as handle:
        handle.write(result.model_dump_json(indent=2))
    result.artifact_path = artifact_path
    return result


def run_suite_sync(suite_path: str, base_url: str, **kwargs) -> BenchmarkRunResult:
    suite = _load_suite(suite_path)
    return asyncio.run(run_suite(suite, base_url or suite.base_url, **kwargs))
