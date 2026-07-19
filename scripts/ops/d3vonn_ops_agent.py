#!/usr/bin/env python3
"""D3VONN governed operations agent.

Safe-by-default: observes and records. Low-risk container restarts require
OPS_AUTO_REMEDIATE=true. Protected actions are never executed by this agent.
"""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any

ALLOWED_CONTAINERS = {
    "d3vonn-hermes",
    "d3vonn-celery-worker",
    "d3vonn-celery-beat",
    "d3vonn-backend",
    "d3vonn-nginx",
    "supreme-ai-deployment-hub-redis-1",
}
PROTECTED_ACTIONS = {
    "deploy_production",
    "apply_database_migration",
    "rotate_production_secret",
    "change_firewall_policy",
    "merge_main",
}


@dataclass
class Evidence:
    component: str
    status: str
    detail: str
    checked_at: str
    latency_ms: int | None = None


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def run(command: list[str], timeout: int = 15) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, capture_output=True, text=True, timeout=timeout, check=False)


def http_check(name: str, url: str) -> Evidence:
    started = time.perf_counter()
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "d3vonn-ops-agent/1.0"})
        with urllib.request.urlopen(request, timeout=8) as response:
            code = response.status
        latency = round((time.perf_counter() - started) * 1000)
        status = "healthy" if 200 <= code < 500 else "unhealthy"
        return Evidence(name, status, f"HTTP {code}", now(), latency)
    except (urllib.error.URLError, TimeoutError) as exc:
        return Evidence(name, "unhealthy", type(exc).__name__, now(), round((time.perf_counter() - started) * 1000))


def container_check(name: str) -> Evidence:
    result = run(["docker", "inspect", "--format", "{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}", name])
    if result.returncode != 0:
        return Evidence(name, "unhealthy", "container missing", now())
    state, health = result.stdout.strip().split("|", 1)
    healthy = state == "running" and health not in {"unhealthy", "starting"}
    return Evidence(name, "healthy" if healthy else "unhealthy", f"state={state} health={health}", now())


def fingerprint(component: str, detail: str) -> str:
    return hashlib.sha256(f"{component}:{detail}".encode()).hexdigest()[:24]


def supabase_write(table: str, rows: list[dict[str, Any]]) -> None:
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base or not key or not rows:
        return
    body = json.dumps(rows).encode()
    request = urllib.request.Request(
        f"{base}/rest/v1/{table}",
        data=body,
        method="POST",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
    )
    try:
        urllib.request.urlopen(request, timeout=8).read()
    except urllib.error.URLError:
        pass


def maybe_restart(evidence: Evidence) -> dict[str, Any] | None:
    if evidence.component not in ALLOWED_CONTAINERS or evidence.status != "unhealthy":
        return None
    if os.getenv("OPS_AUTO_REMEDIATE", "false").lower() != "true":
        return None
    result = run(["docker", "restart", evidence.component], timeout=45)
    return {
        "component": evidence.component,
        "action_type": "restart_container",
        "risk_tier": "low",
        "requested_by": "d3vonn-ops-agent",
        "approval_status": "not_required",
        "execution_status": "succeeded" if result.returncode == 0 else "failed",
        "reason": evidence.detail,
        "command_reference": f"docker restart {evidence.component}",
        "rollback_reference": "docker compose up -d <service>",
        "evidence": {"stdout": result.stdout[-500:], "stderr": result.stderr[-500:]},
        "started_at": now(),
        "completed_at": now(),
    }


def main() -> int:
    evidence = [container_check(name) for name in sorted(ALLOWED_CONTAINERS)]
    evidence.extend(
        [
            http_check("frontend", os.getenv("OPS_FRONTEND_URL", "https://d3vonn.io")),
            http_check("api", os.getenv("OPS_BACKEND_READY_URL", "https://api.d3vonn.io/health/ready")),
        ]
    )
    supabase_write(
        "ops_health_checks",
        [
            {
                "component": item.component,
                "status": item.status,
                "latency_ms": item.latency_ms,
                "source": "vps-operations-agent",
                "evidence": {"detail": item.detail},
                "checked_at": item.checked_at,
            }
            for item in evidence
        ],
    )

    incidents = []
    remediations = []
    for item in evidence:
        if item.status == "unhealthy":
            incidents.append(
                {
                    "fingerprint": fingerprint(item.component, item.detail),
                    "severity": "high" if item.component in {"api", "d3vonn-backend", "d3vonn-nginx"} else "medium",
                    "component": item.component,
                    "title": f"{item.component} health check failed",
                    "status": "open",
                    "probable_cause": item.detail,
                    "impact": "Service availability or background processing may be degraded.",
                    "evidence": asdict(item),
                }
            )
        remediation = maybe_restart(item)
        if remediation:
            remediations.append(remediation)

    supabase_write("ops_incidents", incidents)
    supabase_write("ops_remediations", remediations)
    print(json.dumps({"checked": len(evidence), "unhealthy": len(incidents), "remediated": len(remediations)}, indent=2))
    return 1 if incidents and os.getenv("OPS_FAIL_ON_UNHEALTHY", "false").lower() == "true" else 0


if __name__ == "__main__":
    raise SystemExit(main())
