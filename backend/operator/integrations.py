"""Operator integration adapters.

This module centralizes read-only production integration points for the
Operator Console. Every adapter must be safe-by-default: no mutations,
no deployments, no connector writes, and no secrets returned to callers.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def env_present(name: str) -> bool:
    return bool(os.getenv(name, "").strip())


def github_actions_status() -> dict[str, Any]:
    """Return GitHub Actions adapter readiness.

    Future production implementation should query GitHub Actions using a
    read-only token stored as a secret. This function deliberately returns
    only readiness metadata and never exposes token values.
    """
    return {
        "provider": "github-actions",
        "configured": env_present("GITHUB_TOKEN") or env_present("GH_TOKEN"),
        "mode": "read-only",
        "requiredEnv": ["GITHUB_TOKEN or GH_TOKEN"],
        "lastChecked": utc_now(),
    }


def prometheus_status() -> dict[str, Any]:
    return {
        "provider": "prometheus",
        "configured": env_present("PROMETHEUS_URL"),
        "mode": "read-only",
        "requiredEnv": ["PROMETHEUS_URL"],
        "lastChecked": utc_now(),
    }


def loki_status() -> dict[str, Any]:
    return {
        "provider": "loki",
        "configured": env_present("LOKI_URL"),
        "mode": "read-only",
        "requiredEnv": ["LOKI_URL"],
        "lastChecked": utc_now(),
    }


def otel_status() -> dict[str, Any]:
    return {
        "provider": "opentelemetry",
        "configured": env_present("OTEL_EXPORTER_OTLP_ENDPOINT"),
        "mode": "read-only",
        "requiredEnv": ["OTEL_EXPORTER_OTLP_ENDPOINT"],
        "lastChecked": utc_now(),
    }


def redis_status() -> dict[str, Any]:
    return {
        "provider": "redis",
        "configured": env_present("REDIS_URL"),
        "mode": "read-only-health",
        "requiredEnv": ["REDIS_URL"],
        "lastChecked": utc_now(),
    }


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
    adapters = [
        github_actions_status(),
        prometheus_status(),
        loki_status(),
        otel_status(),
        redis_status(),
        deployment_status(),
    ]
    configured = sum(1 for item in adapters if item.get("configured") is True)
    total = len(adapters)
    return {
        "timestamp": utc_now(),
        "configured": configured,
        "total": total,
        "status": "ready" if configured == total else "partial",
        "adapters": adapters,
    }
