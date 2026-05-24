"""Operator Console API router.

Read-only operational endpoints for DEVONN.AI operator console.
These endpoints intentionally avoid irreversible actions and are safe to expose
behind normal API authentication/proxy controls.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

ROOT = Path(__file__).resolve().parents[2]
STATE_FILE = ROOT / "config" / "operator-console.example.json"
MEMORY_VAULT = ROOT / ".devonn" / "memory-vault"


def utc_now() -> str:
    """Return an ISO-8601 UTC timestamp."""
    return datetime.now(timezone.utc).isoformat()


@router.get("/status")
async def operator_status() -> dict[str, Any]:
    """Return high-level operator readiness state."""
    return {
        "readiness": "yellow",
        "mode": "stabilization",
        "timestamp": utc_now(),
        "surfaces": [
            "ci",
            "memory",
            "connectors",
            "deployments",
            "governance",
            "runtime",
            "observability",
            "agents",
            "events",
            "queues",
            "alerts",
        ],
    }


@router.get("/ci")
async def operator_ci() -> dict[str, Any]:
    """Return canonical production gate set for the operator console."""
    return {
        "status": "green",
        "requiredChecks": [
            "CI - Hardened Build Pipeline",
            "Devonn.AI Testing",
            "CodeQL SAST",
            "Secrets Elimination & Scanning",
            "Final Green Check",
        ],
        "advisoryTools": [
            "ci:doctor",
            "workflow:audit",
            "workflow:classify",
            "repo:entropy",
            "pins:validate",
        ],
    }


@router.get("/memory")
async def operator_memory() -> dict[str, Any]:
    """Return local operational memory vault metadata."""
    entries = 0
    last_export: str | None = None

    if MEMORY_VAULT.exists():
        files = sorted(MEMORY_VAULT.glob("*.md"), key=lambda p: p.stat().st_mtime, reverse=True)
        entries = len(files)
        if files:
            last_export = files[0].name

    return {
        "vaultPath": str(MEMORY_VAULT.relative_to(ROOT)),
        "entries": entries,
        "lastExport": last_export,
        "mode": "local-first",
    }


@router.get("/connectors")
async def operator_connectors() -> dict[str, list[str]]:
    """Return initial connector lane registry."""
    return {
        "production": ["GitHub", "AWS", "Vercel"],
        "staging": ["Supabase", "n8n", "Appsmith", "Gmail", "Google Drive", "Google Calendar"],
        "future": ["Slack", "Notion"],
    }


@router.get("/deployments")
async def operator_deployments() -> dict[str, str]:
    """Return staging deployment readiness placeholders."""
    return {
        "frontend": "staging-ready",
        "api": "pending",
        "database": "pending",
        "redis": "pending",
        "observability": "pending",
    }


@router.get("/governance")
async def operator_governance() -> dict[str, Any]:
    """Return governance posture for branch protection and review state."""
    return {
        "mainProtected": True,
        "manualReviewRequired": True,
        "stagingProtected": False,
        "governanceMode": "manual-review-during-stabilization",
        "requiredProductionChecks": [
            "CI - Hardened Build Pipeline",
            "Devonn.AI Testing",
            "CodeQL SAST",
            "Secrets Elimination & Scanning",
            "Final Green Check",
        ],
    }


@router.get("/runtime")
async def operator_runtime() -> dict[str, str]:
    """Return runtime surface placeholders for future live health checks."""
    return {
        "agents": "observing",
        "queues": "observing",
        "memory": "local-first",
        "dag": "pending-live-check",
        "gitnexus": "pending-live-check",
    }


@router.get("/metrics")
async def operator_metrics() -> dict[str, Any]:
    """Return read-only operator metrics placeholders."""
    return {
        "timestamp": utc_now(),
        "source": "operator-synthetic",
        "series": [
            {"name": "api_latency_ms", "value": 42, "unit": "ms", "status": "healthy"},
            {"name": "queue_depth", "value": 0, "unit": "jobs", "status": "healthy"},
            {"name": "error_rate", "value": 0.0, "unit": "%", "status": "healthy"},
            {"name": "memory_exports", "value": len(list(MEMORY_VAULT.glob('*.md'))) if MEMORY_VAULT.exists() else 0, "unit": "files", "status": "observing"},
        ],
    }


@router.get("/logs")
async def operator_logs() -> dict[str, Any]:
    """Return sanitized log surface placeholders."""
    return {
        "timestamp": utc_now(),
        "source": "operator-synthetic",
        "entries": [
            {"level": "info", "surface": "api", "message": "Operator API ready."},
            {"level": "info", "surface": "ci", "message": "Production gates stabilized."},
            {"level": "info", "surface": "memory", "message": "Local-first memory vault available."},
        ],
    }


@router.get("/traces")
async def operator_traces() -> dict[str, Any]:
    """Return trace surface placeholders."""
    return {
        "timestamp": utc_now(),
        "source": "operator-synthetic",
        "spans": [
            {"name": "operator.status", "durationMs": 4, "status": "ok"},
            {"name": "operator.memory", "durationMs": 7, "status": "ok"},
            {"name": "operator.connectors", "durationMs": 3, "status": "ok"},
        ],
    }


@router.get("/agents")
async def operator_agents() -> dict[str, Any]:
    """Return read-only agent activity mesh state."""
    return {
        "timestamp": utc_now(),
        "agents": [
            {"id": "hermes", "role": "policy-orchestrator", "status": "observing", "lastEvent": "governance review idle"},
            {"id": "tars", "role": "runtime-operator", "status": "standing-by", "lastEvent": "runtime queue healthy"},
            {"id": "ion", "role": "dashboard-intelligence", "status": "online", "lastEvent": "operator console hydrated"},
            {"id": "sapphire", "role": "memory-curator", "status": "online", "lastEvent": "memory vault indexed"},
            {"id": "guardian", "role": "safety-review", "status": "manual-review", "lastEvent": "production gates protected"},
        ],
    }


@router.get("/events")
async def operator_events() -> dict[str, Any]:
    """Return read-only operational event timeline."""
    return {
        "timestamp": utc_now(),
        "events": [
            {"type": "ci.green", "surface": "ci", "message": "Core production gates are green.", "severity": "info"},
            {"type": "memory.ready", "surface": "memory", "message": "Local-first memory vault surface available.", "severity": "info"},
            {"type": "runtime.observing", "surface": "runtime", "message": "Runtime stream heartbeat enabled.", "severity": "info"},
        ],
    }


@router.get("/queues")
async def operator_queues() -> dict[str, Any]:
    """Return read-only queue surface state."""
    return {
        "timestamp": utc_now(),
        "queues": [
            {"name": "agent-execution", "depth": 0, "status": "healthy"},
            {"name": "memory-export", "depth": 0, "status": "healthy"},
            {"name": "deployment-review", "depth": 1, "status": "manual-review"},
            {"name": "governance-alerts", "depth": 0, "status": "healthy"},
        ],
    }


@router.get("/alerts")
async def operator_alerts() -> dict[str, Any]:
    """Return read-only governance and runtime alerts."""
    return {
        "timestamp": utc_now(),
        "alerts": [
            {"level": "notice", "surface": "governance", "message": "PR merge requires manual approval."},
            {"level": "info", "surface": "deployment", "message": "Staging branch creation is queued after main merge."},
            {"level": "info", "surface": "observability", "message": "Synthetic telemetry active until Prometheus/Loki wiring."},
        ],
    }


@router.websocket("/runtime/stream")
async def operator_runtime_stream(websocket: WebSocket) -> None:
    """Emit a read-only operator runtime heartbeat stream."""
    await websocket.accept()

    event_index = 0
    surfaces = ["agents", "queues", "memory", "dag", "gitnexus", "observability", "alerts"]

    try:
        await websocket.send_json(
            {
                "type": "operator.connected",
                "timestamp": utc_now(),
                "message": "Operator runtime stream connected.",
                "severity": "info",
            }
        )

        while True:
            surface = surfaces[event_index % len(surfaces)]
            await websocket.send_json(
                {
                    "type": "operator.heartbeat",
                    "timestamp": utc_now(),
                    "surface": surface,
                    "status": "observing",
                    "severity": "info",
                    "message": f"{surface} surface heartbeat observed.",
                }
            )
            event_index += 1
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        return
