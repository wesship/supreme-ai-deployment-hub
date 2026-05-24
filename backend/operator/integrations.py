"""Operator integration adapters.

This module centralizes read-only production integration points for the
Operator Console. Every adapter must be safe-by-default: no mutations,
no deployments, no connector writes, and no secrets returned to callers.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def env_present(name: str) -> bool:
    return bool(os.getenv(name, "").strip())


def github_token() -> str:
    return os.getenv("GITHUB_TOKEN", "").strip() or os.getenv("GH_TOKEN", "").strip()


def github_repo() -> str:
    return os.getenv("GITHUB_REPOSITORY", "wesship/supreme-ai-deployment-hub").strip()


def github_actions_status() -> dict[str, Any]:
    return {
        "provider": "github-actions",
        "configured": bool(github_token()),
        "mode": "read-only-workflow-runs",
        "requiredEnv": ["GITHUB_TOKEN or GH_TOKEN"],
        "repository": github_repo(),
        "lastChecked": utc_now(),
    }


def github_api_get(path: str) -> dict[str, Any]:
    token = github_token()
    if not token:
        return {"configured": False, "status": "not_configured", "data": {}}

    url = f"https://api.github.com{path}"
    try:
        request = Request(
            url,
            headers={
                "Accept": "application/vnd.github+json",
                "Authorization": f"Bearer {token}",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "devonn-operator-console",
            },
        )
        with urlopen(request, timeout=5) as response:  # noqa: S310 - GitHub API only
            payload = json.loads(response.read().decode("utf-8"))
        return {"configured": True, "status": "ok", "data": payload}
    except Exception as exc:  # pragma: no cover - network dependent
        return {"configured": True, "status": "error", "error": exc.__class__.__name__, "data": {}}


def github_actions_runs(limit: int = 10) -> dict[str, Any]:
    repo = github_repo()
    result = github_api_get(f"/repos/{repo}/actions/runs?per_page={limit}")
    runs = result.get("data", {}).get("workflow_runs", []) if result.get("status") == "ok" else []
    normalized = [
        {
            "id": run.get("id"),
            "name": run.get("name"),
            "status": run.get("status"),
            "conclusion": run.get("conclusion"),
            "branch": run.get("head_branch"),
            "event": run.get("event"),
            "createdAt": run.get("created_at"),
            "updatedAt": run.get("updated_at"),
            "url": run.get("html_url"),
        }
        for run in runs
    ]
    failures = [run for run in normalized if run.get("conclusion") in {"failure", "cancelled", "timed_out"}]
    return {
        "timestamp": utc_now(),
        "provider": "github-actions",
        "repository": repo,
        "configured": result.get("configured", False),
        "status": result.get("status"),
        "error": result.get("error"),
        "runs": normalized,
        "summary": {
            "total": len(normalized),
            "failures": len(failures),
            "healthy": len(failures) == 0 and bool(normalized),
        },
    }


def prometheus_status() -> dict[str, Any]:
    return {
        "provider": "prometheus",
        "configured": env_present("PROMETHEUS_URL"),
        "mode": "read-only-query",
        "requiredEnv": ["PROMETHEUS_URL"],
        "lastChecked": utc_now(),
    }


def prometheus_query(query: str) -> dict[str, Any]:
    base_url = os.getenv("PROMETHEUS_URL", "").strip().rstrip("/")
    if not base_url:
        return {"configured": False, "query": query, "status": "not_configured", "data": []}

    url = f"{base_url}/api/v1/query?{urlencode({'query': query})}"
    try:
        request = Request(url, headers={"Accept": "application/json"})
        with urlopen(request, timeout=3) as response:  # noqa: S310 - internal configured URL only
            payload = json.loads(response.read().decode("utf-8"))
        return {"configured": True, "query": query, "status": payload.get("status", "unknown"), "data": payload.get("data", {}).get("result", [])}
    except Exception as exc:  # pragma: no cover - network dependent
        return {"configured": True, "query": query, "status": "error", "error": exc.__class__.__name__, "data": []}


def prometheus_operator_metrics() -> dict[str, Any]:
    queries = {
        "up": "up",
        "api_request_rate": "sum(rate(http_requests_total[5m]))",
        "api_latency_p95": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))",
        "process_memory_bytes": "process_resident_memory_bytes",
    }
    return {"timestamp": utc_now(), "provider": "prometheus", "configured": env_present("PROMETHEUS_URL"), "results": {name: prometheus_query(query) for name, query in queries.items()}}


def loki_status() -> dict[str, Any]:
    return {"provider": "loki", "configured": env_present("LOKI_URL"), "mode": "read-only", "requiredEnv": ["LOKI_URL"], "lastChecked": utc_now()}


def otel_status() -> dict[str, Any]:
    return {"provider": "opentelemetry", "configured": env_present("OTEL_EXPORTER_OTLP_ENDPOINT"), "mode": "read-only", "requiredEnv": ["OTEL_EXPORTER_OTLP_ENDPOINT"], "lastChecked": utc_now()}


def redis_status() -> dict[str, Any]:
    return {"provider": "redis", "configured": env_present("REDIS_URL"), "mode": "read-only-health", "requiredEnv": ["REDIS_URL"], "lastChecked": utc_now()}


def redis_queue_depths() -> dict[str, Any]:
    queue_names = ["agent-execution", "memory-export", "deployment-review", "governance-alerts"]
    redis_url = os.getenv("REDIS_URL", "").strip()
    if not redis_url:
        return {"timestamp": utc_now(), "provider": "redis", "configured": False, "queues": [{"name": name, "depth": 0, "status": "not_configured"} for name in queue_names]}
    try:
        import redis  # type: ignore
    except ImportError:
        return {"timestamp": utc_now(), "provider": "redis", "configured": True, "dependency": "missing:redis", "queues": [{"name": name, "depth": 0, "status": "dependency_missing"} for name in queue_names]}
    try:
        client = redis.Redis.from_url(redis_url, socket_connect_timeout=2, socket_timeout=2)
        queues = []
        for name in queue_names:
            depth = int(client.llen(name))
            queues.append({"name": name, "depth": depth, "status": "healthy" if depth < 100 else "backlog"})
        return {"timestamp": utc_now(), "provider": "redis", "configured": True, "queues": queues}
    except Exception as exc:  # pragma: no cover - network dependent
        return {"timestamp": utc_now(), "provider": "redis", "configured": True, "error": exc.__class__.__name__, "queues": [{"name": name, "depth": 0, "status": "error"} for name in queue_names]}


def deployment_status() -> dict[str, Any]:
    return {
        "providers": [
            {"name": "vercel", "configured": env_present("VERCEL_TOKEN")},
            {"name": "aws", "configured": env_present("AWS_REGION")},
            {"name": "render", "configured": env_present("RENDER_API_KEY")},
            {"name": "railway", "configured": env_present("RAILWAY_TOKEN")},
        ],
        "mode": "read-only-readiness",
        "lastChecked": utc_now(),
    }


def integration_readiness() -> dict[str, Any]:
    adapters = [github_actions_status(), prometheus_status(), loki_status(), otel_status(), redis_status(), deployment_status()]
    configured = sum(1 for item in adapters if item.get("configured") is True)
    total = len(adapters)
    return {"timestamp": utc_now(), "configured": configured, "total": total, "status": "ready" if configured == total else "partial", "adapters": adapters}
