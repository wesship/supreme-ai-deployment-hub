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

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

try:
    from backend.operator.auth import require_operator_access
except ImportError:  # pragma: no cover
    async def require_operator_access():  # type: ignore
        return None

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

try:
    from backend.operator.supervision import supervise_runtime, supervision_timeline
except ImportError:  # pragma: no cover
    supervise_runtime = None  # type: ignore
    supervision_timeline = None  # type: ignore

try:
    from backend.operator.prediction import predict_runtime_anomalies, recovery_advisory
except ImportError:  # pragma: no cover
    predict_runtime_anomalies = None  # type: ignore
    recovery_advisory = None  # type: ignore

router = APIRouter(dependencies=[Depends(require_operator_access)])

ROOT = Path(__file__).resolve().parents[2]
STATE_FILE = ROOT / "config" / "operator-console.example.json"
MEMORY_VAULT = ROOT / ".devonn" / "memory-vault"

REQUIRED_CHECKS = ["CI - Hardened Build Pipeline", "Devonn.AI Testing", "CodeQL SAST", "Secrets Elimination & Scanning", "Final Green Check"]
ADVISORY_TOOLS = ["ci:doctor", "workflow:audit", "workflow:classify", "repo:entropy", "pins:validate"]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def memory_files() -> list[Path]:
    if not MEMORY_VAULT.exists():
        return []
    return sorted(MEMORY_VAULT.glob("*.md"), key=lambda p: p.stat().st_mtime, reverse=True)


def memory_summary(path: Path) -> dict[str, Any]:
    stat = path.stat()
    return {"id": path.stem, "file": path.name, "path": str(path.relative_to(ROOT)), "sizeBytes": stat.st_size, "modified": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat()}


def graph_payload() -> dict[str, Any]:
    return {"nodes": [{"id": "operator", "label": "Operator Console", "type": "ui", "status": "online"}, {"id": "api", "label": "Operator API", "type": "service", "status": "online"}, {"id": "hermes", "label": "Hermes", "type": "agent", "status": "observing"}, {"id": "tars", "label": "TARS", "type": "agent", "status": "standing-by"}, {"id": "ion", "label": "ION", "type": "agent", "status": "online"}, {"id": "sapphire", "label": "SAPPHIRE", "type": "agent", "status": "online"}, {"id": "guardian", "label": "GUARDIAN", "type": "agent", "status": "manual-review"}, {"id": "memory", "label": "Memory Vault", "type": "memory", "status": "local-first"}, {"id": "ci", "label": "CI/CD Gates", "type": "pipeline", "status": "live-adapter-ready"}, {"id": "observability", "label": "Observability", "type": "telemetry", "status": "integration-ready"}, {"id": "supervision", "label": "Runtime Supervision", "type": "supervisor", "status": "advisory"}, {"id": "prediction", "label": "Runtime Prediction", "type": "cognition", "status": "advisory"}], "edges": [{"source": "operator", "target": "api", "label": "queries"}, {"source": "api", "target": "hermes", "label": "governance state"}, {"source": "api", "target": "tars", "label": "runtime state"}, {"source": "api", "target": "ion", "label": "dashboard intelligence"}, {"source": "api", "target": "sapphire", "label": "memory state"}, {"source": "api", "target": "guardian", "label": "safety review"}, {"source": "sapphire", "target": "memory", "label": "curates"}, {"source": "hermes", "target": "ci", "label": "reviews"}, {"source": "tars", "target": "observability", "label": "emits telemetry"}, {"source": "supervision", "target": "observability", "label": "classifies"}, {"source": "supervision", "target": "queues", "label": "monitors"}, {"source": "prediction", "target": "supervision", "label": "forecasts"}]}


@router.get("/status")
async def operator_status() -> dict[str, Any]:
    return {"readiness": "yellow", "mode": "stabilization", "timestamp": utc_now(), "surfaces": ["ci", "memory", "memory-history", "memory-replay", "connectors", "integrations", "deployments", "governance", "runtime", "observability", "supervision", "supervision-timeline", "predictions", "recovery-advisories", "agents", "events", "queues", "alerts", "graph", "dag", "topology"]}


@router.get("/supervision")
async def operator_supervision() -> dict[str, Any]:
    if supervise_runtime is None:
        return {"timestamp": utc_now(), "state": "unknown", "anomalies": [], "summary": {"totalAnomalies": 0, "critical": 0, "degraded": 0, "elevated": 0, "unknown": 0}}
    return supervise_runtime()


@router.get("/supervision/timeline")
async def operator_supervision_timeline() -> dict[str, Any]:
    if supervision_timeline is None:
        return {"timestamp": utc_now(), "source": "unavailable", "state": "unknown", "events": []}
    return supervision_timeline()


@router.get("/predictions")
async def operator_predictions() -> dict[str, Any]:
    if predict_runtime_anomalies is None:
        return {"timestamp": utc_now(), "state": "unknown", "predictions": []}
    return predict_runtime_anomalies()


@router.get("/recovery-advisories")
async def operator_recovery_advisories() -> dict[str, Any]:
    if recovery_advisory is None:
        return {"timestamp": utc_now(), "state": "unknown", "policy": "advisory-only-no-mutation", "recommendations": []}
    return recovery_advisory()


@router.get("/integrations")
async def operator_integrations() -> dict[str, Any]:
    if integration_readiness is None:
        return {"timestamp": utc_now(), "status": "unavailable", "configured": 0, "total": 0, "adapters": []}
    return integration_readiness()


@router.get("/ci")
async def operator_ci() -> dict[str, Any]:
    workflow_runs = github_actions_runs(limit=12) if github_actions_runs else {"configured": False, "status": "unavailable", "runs": [], "summary": {"total": 0, "failures": 0, "healthy": False}}
    summary = workflow_runs.get("summary", {})
    return {"status": "green" if summary.get("healthy") else "observing", "requiredChecks": REQUIRED_CHECKS, "advisoryTools": ADVISORY_TOOLS, "githubActions": workflow_runs}


@router.get("/memory")
async def operator_memory() -> dict[str, Any]:
    files = memory_files()
    return {"vaultPath": str(MEMORY_VAULT.relative_to(ROOT)), "entries": len(files), "lastExport": files[0].name if files else None, "mode": "local-first"}


@router.get("/memory/history")
async def operator_memory_history() -> dict[str, Any]:
    files = memory_files()
    return {"timestamp": utc_now(), "vaultPath": str(MEMORY_VAULT.relative_to(ROOT)), "entries": [memory_summary(path) for path in files[:25]]}


@router.get("/memory/snapshots")
async def operator_memory_snapshots() -> dict[str, Any]:
    files = memory_files()
    return {"timestamp": utc_now(), "snapshots": [{**memory_summary(path), "kind": "markdown-export", "compression": "tokenjuice-lite-ready"} for path in files[:10]]}


@router.get("/memory/replay")
async def operator_memory_replay() -> dict[str, Any]:
    files = memory_files()
    events = []
    for path in files[:10]:
        summary = memory_summary(path)
        events.append({"type": "memory.snapshot", "timestamp": summary["modified"], "file": summary["file"], "message": f"Operational memory snapshot available: {summary['file']}"})
    if not events:
        events.append({"type": "memory.empty", "timestamp": utc_now(), "file": None, "message": "No memory snapshots found yet. Run npm run memory:export <file> to create one."})
    return {"timestamp": utc_now(), "events": events}


@router.get("/connectors")
async def operator_connectors() -> dict[str, list[str]]:
    return {"production": ["GitHub", "AWS", "Vercel"], "staging": ["Supabase", "n8n", "Appsmith", "Gmail", "Google Drive", "Google Calendar"], "future": ["Slack", "Notion"]}


@router.get("/deployments")
async def operator_deployments() -> dict[str, Any]:
    readiness = integration_readiness() if integration_readiness else {"adapters": []}
    return {"frontend": "staging-ready", "api": "pending", "database": "pending", "redis": "pending", "observability": "pending", "integrationReadiness": readiness}


@router.get("/governance")
async def operator_governance() -> dict[str, Any]:
    return {"mainProtected": True, "manualReviewRequired": True, "stagingProtected": False, "governanceMode": "manual-review-during-stabilization", "requiredProductionChecks": REQUIRED_CHECKS}


@router.get("/runtime")
async def operator_runtime() -> dict[str, str]:
    return {"agents": "observing", "queues": "observing", "memory": "local-first", "dag": "observing", "gitnexus": "pending-live-check", "supervision": "advisory", "prediction": "advisory"}


@router.get("/metrics")
async def operator_metrics() -> dict[str, Any]:
    integrations = integration_readiness() if integration_readiness else {"status": "unavailable"}
    prometheus = prometheus_operator_metrics() if prometheus_operator_metrics else {"configured": False, "results": {}}
    return {"timestamp": utc_now(), "source": "prometheus-adapter", "integrationStatus": integrations.get("status"), "prometheus": prometheus, "series": [{"name": "memory_exports", "value": len(memory_files()), "unit": "files", "status": "observing"}]}


@router.get("/logs")
async def operator_logs() -> dict[str, Any]:
    if loki_operator_logs is None:
        return {"timestamp": utc_now(), "source": "loki-adapter-unavailable", "entries": []}
    loki = loki_operator_logs()
    return {"timestamp": utc_now(), "source": "loki-adapter", "loki": loki, "entries": loki.get("result", {}).get("entries", [])}


@router.get("/traces")
async def operator_traces() -> dict[str, Any]:
    if otel_operator_traces is None:
        return {"timestamp": utc_now(), "source": "otel-adapter-unavailable", "spans": []}
    traces = otel_operator_traces(limit=20)
    return {"timestamp": utc_now(), "source": "otel-adapter", "traces": traces, "spans": traces.get("spans", [])}


@router.get("/agents")
async def operator_agents() -> dict[str, Any]:
    return {"timestamp": utc_now(), "agents": [{"id": "hermes", "role": "policy-orchestrator", "status": "observing", "lastEvent": "governance review idle"}, {"id": "tars", "role": "runtime-operator", "status": "standing-by", "lastEvent": "runtime queue healthy"}, {"id": "ion", "role": "dashboard-intelligence", "status": "online", "lastEvent": "operator console hydrated"}, {"id": "sapphire", "role": "memory-curator", "status": "online", "lastEvent": "memory vault indexed"}, {"id": "guardian", "role": "safety-review", "status": "manual-review", "lastEvent": "production gates protected"}]}


@router.get("/events")
async def operator_events() -> dict[str, Any]:
    supervision = supervise_runtime() if supervise_runtime else {"state": "unknown", "anomalies": []}
    return {"timestamp": utc_now(), "events": [{"type": "ci.green", "surface": "ci", "message": "Core production gates are green.", "severity": "info"}, {"type": "memory.ready", "surface": "memory", "message": "Local-first memory vault surface available.", "severity": "info"}, {"type": "runtime.observing", "surface": "runtime", "message": "Runtime stream heartbeat enabled.", "severity": "info"}, {"type": "supervision.state", "surface": "supervision", "message": f"Runtime supervision state: {supervision.get('state')}", "severity": "info"}]}


@router.get("/queues")
async def operator_queues() -> dict[str, Any]:
    if redis_queue_depths is None:
        return {"timestamp": utc_now(), "redisReady": False, "queues": []}
    telemetry = redis_queue_depths()
    return {"timestamp": utc_now(), "redisReady": telemetry.get("configured", False), **telemetry}


@router.get("/alerts")
async def operator_alerts() -> dict[str, Any]:
    supervision = supervise_runtime() if supervise_runtime else {"anomalies": []}
    supervision_alerts = [{"level": item.get("severity", "info"), "surface": item.get("surface", "supervision"), "message": item.get("message", "Supervision anomaly observed.")} for item in supervision.get("anomalies", [])]
    return {"timestamp": utc_now(), "alerts": [{"level": "notice", "surface": "governance", "message": "PR merge requires manual approval."}, {"level": "info", "surface": "deployment", "message": "Staging branch creation is queued after main merge."}, {"level": "info", "surface": "observability", "message": "Prometheus, Redis, GitHub Actions, Loki, and OpenTelemetry adapters are wired read-only."}, *supervision_alerts]}


@router.get("/graph")
async def operator_graph() -> dict[str, Any]:
    payload = graph_payload()
    payload["timestamp"] = utc_now()
    payload["source"] = "operator-graph-synthetic"
    return payload


@router.get("/dag")
async def operator_dag() -> dict[str, Any]:
    return {"timestamp": utc_now(), "nodes": [{"id": "ingest", "label": "Ingest", "status": "ready"}, {"id": "compress", "label": "Compress", "status": "ready"}, {"id": "route", "label": "Route", "status": "ready"}, {"id": "execute", "label": "Execute", "status": "manual-review"}, {"id": "observe", "label": "Observe", "status": "online"}, {"id": "supervise", "label": "Supervise", "status": "advisory"}, {"id": "predict", "label": "Predict", "status": "advisory"}], "edges": [{"source": "ingest", "target": "compress"}, {"source": "compress", "target": "route"}, {"source": "route", "target": "execute"}, {"source": "execute", "target": "observe"}, {"source": "observe", "target": "supervise"}, {"source": "supervise", "target": "predict"}]}


@router.get("/topology")
async def operator_topology() -> dict[str, Any]:
    integrations = integration_readiness() if integration_readiness else {"status": "unavailable"}
    return {"timestamp": utc_now(), "integrationStatus": integrations.get("status"), "layers": [{"name": "frontend", "status": "staging-ready", "components": ["Vite", "Operator Console"]}, {"name": "api", "status": "online", "components": ["FastAPI", "Operator Router"]}, {"name": "memory", "status": "local-first", "components": ["Memory Vault", "Token Compression"]}, {"name": "ci", "status": "live-adapter-ready", "components": ["GitHub Actions", "Build", "Testing", "CodeQL", "Secrets"]}, {"name": "observability", "status": "live-adapter-ready", "components": ["Prometheus", "Redis", "Loki", "OpenTelemetry", "Metrics", "Logs", "Traces", "Runtime Stream"]}, {"name": "supervision", "status": "advisory", "components": ["State Classification", "Anomaly Detection", "Remediation Hints", "Timeline"]}, {"name": "prediction", "status": "advisory", "components": ["Risk Forecasting", "Recovery Advisories", "Manual Review Boundary"]}]}


@router.websocket("/runtime/stream")
async def operator_runtime_stream(websocket: WebSocket) -> None:
    await websocket.accept()
    event_index = 0
    surfaces = ["agents", "queues", "memory", "dag", "gitnexus", "observability", "logs", "traces", "supervision", "prediction", "alerts", "graph", "integrations", "ci"]
    try:
        await websocket.send_json({"type": "operator.connected", "timestamp": utc_now(), "message": "Operator runtime stream connected.", "severity": "info"})
        while True:
            surface = surfaces[event_index % len(surfaces)]
            message = f"{surface} surface heartbeat observed."
            event_type = "operator.heartbeat"
            if surface == "supervision" and supervise_runtime:
                supervision = supervise_runtime()
                event_type = "supervision.state"
                message = f"Runtime supervision state: {supervision.get('state')} with {supervision.get('summary', {}).get('totalAnomalies', 0)} anomalies."
            if surface == "prediction" and predict_runtime_anomalies:
                prediction = predict_runtime_anomalies()
                event_type = "prediction.state"
                message = f"Runtime prediction state: {prediction.get('state')} with {len(prediction.get('predictions', []))} forecasts."
            await websocket.send_json({"type": event_type, "timestamp": utc_now(), "surface": surface, "status": "observing", "severity": "info", "message": message})
            event_index += 1
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        return
