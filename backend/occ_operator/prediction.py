"""Runtime anomaly prediction and recovery advisory engine.

Read-only advisory layer. It never mutates infrastructure or performs recovery.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

try:
    from backend.occ_operator.supervision import supervise_runtime
except ImportError:  # pragma: no cover
    supervise_runtime = None  # type: ignore


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def predict_runtime_anomalies() -> dict[str, Any]:
    snapshot = supervise_runtime() if supervise_runtime else {"state": "unknown", "anomalies": [], "summary": {}}
    anomalies = snapshot.get("anomalies", [])
    predictions = []

    surfaces = {item.get("surface") for item in anomalies}
    severities = {item.get("severity") for item in anomalies}

    if "queues" in surfaces:
        predictions.append({
            "risk": "queue_saturation",
            "likelihood": "medium" if "elevated" in severities else "high",
            "message": "Queue pressure may continue rising if worker throughput does not improve.",
            "watch": ["REDIS_URL", "worker throughput", "retry loops", "queue depth"],
        })

    if "ci" in surfaces:
        predictions.append({
            "risk": "deployment_instability",
            "likelihood": "medium",
            "message": "Recent CI failures may block staging or production promotion.",
            "watch": ["GitHub Actions", "required checks", "branch protection"],
        })

    if {"metrics", "logs", "traces"}.intersection(surfaces):
        predictions.append({
            "risk": "observability_blind_spot",
            "likelihood": "high",
            "message": "Missing telemetry can reduce incident detection and delay recovery decisions.",
            "watch": ["Prometheus", "Loki", "Tempo/Jaeger", "adapter env vars"],
        })

    if not predictions:
        predictions.append({
            "risk": "nominal",
            "likelihood": "low",
            "message": "No immediate anomaly trajectory detected from current supervision snapshot.",
            "watch": ["runtime stream", "queue depth", "CI status", "observability adapters"],
        })

    return {
        "timestamp": utc_now(),
        "state": snapshot.get("state", "unknown"),
        "predictions": predictions,
    }


def recovery_advisory() -> dict[str, Any]:
    snapshot = supervise_runtime() if supervise_runtime else {"state": "unknown", "anomalies": []}
    recommendations = []

    for item in snapshot.get("anomalies", []):
        surface = item.get("surface", "unknown")
        severity = item.get("severity", "unknown")
        recommendations.append({
            "surface": surface,
            "severity": severity,
            "action": item.get("recommendation", "Review operator telemetry."),
            "mode": "manual-review-required",
            "safeToAutomate": False,
        })

    if not recommendations:
        recommendations.append({
            "surface": "runtime",
            "severity": "info",
            "action": "Continue monitoring. No recovery action recommended from current snapshot.",
            "mode": "observe-only",
            "safeToAutomate": False,
        })

    return {
        "timestamp": utc_now(),
        "state": snapshot.get("state", "unknown"),
        "recommendations": recommendations,
        "policy": "advisory-only-no-mutation",
    }
