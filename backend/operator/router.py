"""Operator Console API router.

Read-only operational endpoints for DEVONN.AI operator console.
These endpoints intentionally avoid irreversible actions and are safe to expose
behind normal API authentication/proxy controls.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter

router = APIRouter()

ROOT = Path(__file__).resolve().parents[2]
STATE_FILE = ROOT / "config" / "operator-console.example.json"
MEMORY_VAULT = ROOT / ".devonn" / "memory-vault"


@router.get("/status")
async def operator_status() -> dict[str, Any]:
    """Return high-level operator readiness state."""
    return {
        "readiness": "yellow",
        "mode": "stabilization",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "surfaces": [
            "ci",
            "memory",
            "connectors",
            "deployments",
            "governance",
            "runtime",
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
        "agents": "pending-live-check",
        "queues": "pending-live-check",
        "memory": "local-first",
        "dag": "pending-live-check",
        "gitnexus": "pending-live-check",
    }
