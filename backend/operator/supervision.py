"""Autonomous runtime supervision engine.

This module classifies operator telemetry into machine-readable operational
states. It is read-only and advisory: it never mutates infrastructure, deploys
code, or executes remediation actions.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

try:
    from backend.operator.integrations import (
        github_actions_runs,
        integration_readiness,
        loki_operator_logs,
        otel_operator_traces,
        prometheus_operator_metrics,
        redis_queue_depths,
    )
except ImportError:  # pragma: no cover
    github_actions_runs = None  # type: ignore
    integration_readiness = None  # type: ignore
    loki_operator_logs = None  # type: ignore
    otel_operator_traces = None  # type: ignore
    prometheus_operator_metrics = None  # type: ignore
    redis_queue_depths = None  # type: ignore


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def anomaly(severity: str, surface: str, message: str, recommendation: str) -> dict[str, str]:
    return {
        "severity": severity,
        "surface": surface,
        "message": message,
        "recommendation": recommendation,
    }


def classify_state(anomalies: list[dict[str, str]]) -> str:
    severities = {item["severity"] for item in anomalies}
    if "critical" in severities:
        return "critical"
    if "degraded" in severities:
        return "degraded"
    if "elevated" in severities:
        return "elevated"
    if "unknown" in severities:
        return "unknown"
    return "healthy"


def supervise_runtime() -> dict[str, Any]:
    """Return advisory runtime supervision state."""
    anomalies: list[dict[str, str]] = []

    integrations = integration_readiness() if integration_readiness else {"status": "unavailable", "adapters": []}
    if integrations.get("status") != "ready":
        anomalies.append(
            anomaly(
                "elevated",
                "integrations",
                "One or more production adapters are not fully configured.",
                "Review /api/operator/integrations and configure missing env vars before production promotion.",
            )
        )

    metrics = prometheus_operator_metrics() if prometheus_operator_metrics else {"configured": False, "results": {}}
    if not metrics.get("configured"):
        anomalies.append(
            anomaly(
                "unknown",
                "metrics",
                "Prometheus telemetry is not configured.",
                "Set PROMETHEUS_URL for live metrics before staging acceptance.",
            )
        )
    else:
        failed_metrics = [
            name
            for name, result in (metrics.get("results") or {}).items()
            if result.get("status") not in {"success", "ok"}
        ]
        if failed_metrics:
            anomalies.append(
                anomaly(
                    "degraded",
                    "metrics",
                    f"Prometheus queries failed or returned no success state: {', '.join(failed_metrics)}.",
                    "Validate Prometheus endpoint, scrape config, and metric names.",
                )
            )

    queues = redis_queue_depths() if redis_queue_depths else {"configured": False, "queues": []}
    if not queues.get("configured"):
        anomalies.append(
            anomaly(
                "unknown",
                "queues",
                "Redis queue telemetry is not configured.",
                "Set REDIS_URL and install redis dependency for live queue supervision.",
            )
        )
    else:
        for queue in queues.get("queues", []):
            depth = int(queue.get("depth", 0))
            if depth >= 100:
                anomalies.append(
                    anomaly(
                        "critical",
                        "queues",
                        f"Queue {queue.get('name')} depth is critical at {depth}.",
                        "Pause non-essential producers, inspect workers, and drain backlog before deployment.",
                    )
                )
            elif depth >= 25:
                anomalies.append(
                    anomaly(
                        "elevated",
                        "queues",
                        f"Queue {queue.get('name')} depth is elevated at {depth}.",
                        "Inspect worker throughput and retry activity.",
                    )
                )

    ci = github_actions_runs(limit=10) if github_actions_runs else {"configured": False, "summary": {}}
    if not ci.get("configured"):
        anomalies.append(
            anomaly(
                "unknown",
                "ci",
                "GitHub Actions telemetry is not configured.",
                "Set GH_TOKEN or GITHUB_TOKEN with read-only workflow access.",
            )
        )
    elif int(ci.get("summary", {}).get("failures", 0)) > 0:
        anomalies.append(
            anomaly(
                "degraded",
                "ci",
                "Recent GitHub Actions runs include failures.",
                "Review /api/operator/ci and block production promotion until checks recover.",
            )
        )

    logs = loki_operator_logs() if loki_operator_logs else {"configured": False, "result": {}}
    if not logs.get("configured"):
        anomalies.append(
            anomaly(
                "unknown",
                "logs",
                "Loki log ingestion is not configured.",
                "Set LOKI_URL for live log supervision.",
            )
        )
    elif logs.get("result", {}).get("status") == "error":
        anomalies.append(
            anomaly(
                "degraded",
                "logs",
                "Loki query returned an error.",
                "Validate Loki URL, query selector, and log labels.",
            )
        )

    traces = otel_operator_traces(limit=10) if otel_operator_traces else {"configured": False, "spans": []}
    if not traces.get("configured"):
        anomalies.append(
            anomaly(
                "unknown",
                "traces",
                "Trace query backend is not configured.",
                "Set TEMPO_URL or JAEGER_QUERY_URL for trace supervision.",
            )
        )
    elif traces.get("status") == "error":
        anomalies.append(
            anomaly(
                "degraded",
                "traces",
                "Trace backend query returned an error.",
                "Validate Tempo or Jaeger query endpoint configuration.",
            )
        )

    state = classify_state(anomalies)
    return {
        "timestamp": utc_now(),
        "state": state,
        "anomalies": anomalies,
        "summary": {
            "totalAnomalies": len(anomalies),
            "critical": sum(1 for item in anomalies if item["severity"] == "critical"),
            "degraded": sum(1 for item in anomalies if item["severity"] == "degraded"),
            "elevated": sum(1 for item in anomalies if item["severity"] == "elevated"),
            "unknown": sum(1 for item in anomalies if item["severity"] == "unknown"),
        },
    }
