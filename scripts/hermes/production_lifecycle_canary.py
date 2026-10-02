#!/usr/bin/env python3
"""Production lifecycle canary for the persistent Hermes worker mesh.

Creates one clearly tagged synthetic Hermes task through the authenticated API
boundary and proves that a real persistent worker heartbeats, atomically claims
it, creates a lease, completes the task, and releases the lease.

This script intentionally does not alter schemas, enable model-council authority,
or bypass the worker runtime.
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone
from typing import Any

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
API_BASE_URL = os.getenv("API_BASE_URL", "https://api.d3vonn.io").rstrip("/")
TIMEOUT_SECONDS = int(os.getenv("HERMES_CANARY_TIMEOUT_SECONDS", "180"))
POLL_SECONDS = float(os.getenv("HERMES_CANARY_POLL_SECONDS", "5"))
MAX_HEARTBEAT_AGE_SECONDS = int(os.getenv("HERMES_CANARY_MAX_HEARTBEAT_AGE_SECONDS", "120"))
CERTIFIED_SHA = os.environ["CERTIFIED_SHA"]
_API_HEADERS: dict[str, str] = {}


def _json_request(
    url: str,
    *,
    method: str = "GET",
    payload: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> Any:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request_headers = {
        "Accept": "application/json",
        **(headers or {}),
    }
    if body is not None:
        request_headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=body, headers=request_headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} for {url}: {detail}") from exc


def _rest_headers(*, representation: bool = False) -> dict[str, str]:
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    }
    if representation:
        headers["Prefer"] = "return=representation"
    return headers


def _table_get(table: str, params: dict[str, str]) -> list[dict[str, Any]]:
    query = urllib.parse.urlencode(params, safe="(),.*:-_")
    result = _json_request(
        f"{SUPABASE_URL}/rest/v1/{table}?{query}",
        headers=_rest_headers(),
    )
    if not isinstance(result, list):
        raise RuntimeError(f"Expected list from {table}, got {type(result).__name__}")
    return result


def authenticate_operator() -> None:
    """Use the protected test user's actual JWT; never service-role API authority."""
    session = _json_request(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        method="POST",
        headers={"apikey": SERVICE_ROLE_KEY},
        payload={"email": os.environ["E2E_TEST_EMAIL"], "password": os.environ["E2E_TEST_PASSWORD"]},
    )
    token = session.get("access_token") if isinstance(session, dict) else None
    if not isinstance(token, str) or not token:
        raise RuntimeError("Protected operator authentication returned no access token")
    _API_HEADERS["Authorization"] = f"Bearer {token}"
    _json_request(f"{API_BASE_URL}/api/hermes/tasks?limit=1", headers=_API_HEADERS)
    print("PASS authenticated Hermes operator boundary")


def _parse_timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def verify_api_health() -> None:
    identity = _json_request(f"{API_BASE_URL}/api/runtime/identity")
    if identity.get("commit_sha") != CERTIFIED_SHA:
        raise RuntimeError("API commit does not match certified source")
    deployment = _json_request(f"{API_BASE_URL}/health/deployment")
    if not isinstance(deployment, dict):
        raise RuntimeError("Production deployment health did not return JSON object")
    if str(deployment.get("status", "")).lower() not in {"ok", "healthy"}:
        raise RuntimeError(f"Production deployment is not healthy: {deployment}")
    print("PASS production deployment health")


def require_fresh_worker() -> dict[str, Any]:
    workers = _table_get(
        "hermes_workers",
        {
            "select": "worker_id,status,last_heartbeat_at,active_leases,max_leases,capabilities,version_counter,metadata",
            "status": "in.(healthy,busy)",
            "order": "last_heartbeat_at.desc",
            "limit": "10",
        },
    )
    now = datetime.now(timezone.utc)
    for worker in workers:
        heartbeat = worker.get("last_heartbeat_at")
        if not heartbeat:
            continue
        age = (now - _parse_timestamp(str(heartbeat))).total_seconds()
        if 0 <= age <= MAX_HEARTBEAT_AGE_SECONDS and (worker.get("metadata") or {}).get("commit_sha") == CERTIFIED_SHA:
            print(
                "PASS fresh worker heartbeat",
                worker.get("worker_id"),
                f"age={age:.1f}s",
                f"status={worker.get('status')}",
            )
            return worker
    raise RuntimeError(
        f"No healthy/busy Hermes worker heartbeat within {MAX_HEARTBEAT_AGE_SECONDS}s"
    )


def create_canary_task() -> dict[str, Any]:
    correlation_id = f"hermes-prod-cert-{uuid.uuid4()}"
    result = _json_request(
        f"{API_BASE_URL}/api/hermes/tasks",
        method="POST",
        headers=_API_HEADERS,
        payload={
            "title": "Hermes production lifecycle certification canary",
            "description": "Synthetic production canary. Safe to execute and audit.",
            "task_type": "generic",
            "priority": 1,
            "source": "github-production-canary",
            "agent_name": "TARS",
            "correlation_id": correlation_id,
            "input_data": {
                "certification": True,
                "mode": "production-lifecycle-canary",
                "instruction": "Return a short deterministic acknowledgement for Hermes lifecycle certification.",
            },
        },
    )
    task = result.get("task") if isinstance(result, dict) else None
    if not isinstance(task, dict) or not task.get("id"):
        raise RuntimeError("Authenticated API did not return a created task")
    print("PASS synthetic task created", task.get("id"), correlation_id)
    return task


def wait_for_completion(task_id: str) -> tuple[dict[str, Any], dict[str, Any]]:
    deadline = time.monotonic() + TIMEOUT_SECONDS
    seen_lease: dict[str, Any] | None = None
    last_status = None

    while time.monotonic() < deadline:
        result = _json_request(f"{API_BASE_URL}/api/hermes/tasks/{task_id}", headers=_API_HEADERS)
        task = result.get("task") if isinstance(result, dict) else None
        if not isinstance(task, dict):
            raise RuntimeError(f"Canary task disappeared from authenticated API: {task_id}")
        status = str(task.get("status") or "")
        if status != last_status:
            print("INFO task status", status, "worker", task.get("assigned_to"))
            last_status = status

        leases = _table_get(
            "hermes_worker_leases",
            {
                "select": "lease_id,task_id,worker_id,status,acquired_at,renewed_at,expires_at,updated_at",
                "task_id": f"eq.{task_id}",
                "order": "created_at.desc",
                "limit": "1",
            },
        )
        if leases:
            seen_lease = leases[0]

        if status == "FAILED":
            raise RuntimeError(f"Hermes canary task failed: {task.get('error_message')}")
        if status == "CANCELLED":
            raise RuntimeError("Hermes canary task was cancelled")
        if status == "COMPLETED":
            if seen_lease is None:
                raise RuntimeError("Task completed without observable persistent worker lease")
            lease_status = str(seen_lease.get("status") or "")
            if lease_status == "active":
                time.sleep(POLL_SECONDS)
                continue
            if lease_status != "released":
                raise RuntimeError(f"Expected released lease, got {lease_status!r}")
            if not task.get("assigned_to"):
                raise RuntimeError("Completed task has no assigned worker")
            print(
                "PASS task completed through persistent worker",
                task.get("assigned_to"),
                "lease",
                seen_lease.get("lease_id"),
            )
            return task, seen_lease

        time.sleep(POLL_SECONDS)

    raise TimeoutError(f"Hermes production canary timed out after {TIMEOUT_SECONDS}s")


def verify_worker_after_completion(worker_id: str) -> None:
    rows = _table_get(
        "hermes_workers",
        {
            "select": "worker_id,status,last_heartbeat_at,active_leases,max_leases,version_counter,metadata",
            "worker_id": f"eq.{worker_id}",
            "limit": "1",
        },
    )
    if not rows:
        raise RuntimeError(f"Worker missing after canary completion: {worker_id}")
    worker = rows[0]
    if (worker.get("metadata") or {}).get("commit_sha") != CERTIFIED_SHA:
        raise RuntimeError("Completing worker commit does not match certified source")
    if str(worker.get("status")) not in {"healthy", "busy"}:
        raise RuntimeError(f"Worker ended in unhealthy state: {worker}")
    if int(worker.get("active_leases") or 0) < 0:
        raise RuntimeError(f"Worker has invalid active lease count: {worker}")
    print(
        "PASS worker remained healthy after release",
        worker_id,
        "active_leases=",
        worker.get("active_leases"),
        "version_counter=",
        worker.get("version_counter"),
    )


def main() -> int:
    verify_api_health()
    authenticate_operator()
    require_fresh_worker()
    task = create_canary_task()
    completed, lease = wait_for_completion(str(task["id"]))
    worker_id = str(lease["worker_id"])
    if completed.get("assigned_to") != worker_id:
        raise RuntimeError(
            f"Task/lease worker mismatch: task={completed.get('assigned_to')} lease={worker_id}"
        )
    verify_worker_after_completion(worker_id)
    print("HERMES PRODUCTION LIFECYCLE CERTIFICATION: PASS")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"HERMES PRODUCTION LIFECYCLE CERTIFICATION: FAIL: {exc}", file=sys.stderr)
        raise
