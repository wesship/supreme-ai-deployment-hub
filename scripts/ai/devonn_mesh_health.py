#!/usr/bin/env python3
"""
devonn_mesh_health.py — Devonn.AI Agent Mesh Health Monitor

Replaces the stub run_devonn_ai.py with a production-ready health monitor that:
  1. Checks all critical service endpoints (API, Supabase, OpenAI, EKS)
  2. Reports structured JSON health status
  3. Triggers self-healing actions when services are degraded
  4. Posts alerts to Slack when critical failures are detected

Usage:
  python3 scripts/ai/devonn_mesh_health.py
  python3 scripts/ai/devonn_mesh_health.py --heal       # attempt auto-healing
  python3 scripts/ai/devonn_mesh_health.py --json       # output JSON only
"""

import argparse
import json
import os
import subprocess
import sys
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional
import httpx


# ── Configuration ──────────────────────────────────────────────────────────────
SERVICES = [
    {"name": "devonn-api",       "url": "https://api.d3vonn.io/status/health",      "critical": True},
    {"name": "devonn-api-deep",  "url": "https://api.d3vonn.io/status/health/deep", "critical": True},
    {"name": "devonn-frontend",  "url": "https://d3vonn.io",                         "critical": True},
    {"name": "supabase",         "url": os.getenv("SUPABASE_URL", "") + "/health",   "critical": True},
    {"name": "openai",           "url": "https://api.openai.com/v1/models",          "critical": False},
]

SLACK_WEBHOOK = os.getenv("SLACK_WEBHOOK_CRITICAL", "")
TIMEOUT_SECONDS = 10
MAX_RETRIES = 3


@dataclass
class ServiceHealth:
    name: str
    url: str
    status: str          # "healthy" | "degraded" | "down" | "unknown"
    http_code: Optional[int] = None
    latency_ms: Optional[float] = None
    error: Optional[str] = None
    checked_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class MeshHealth:
    overall: str         # "healthy" | "degraded" | "critical"
    services: list[ServiceHealth] = field(default_factory=list)
    checked_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    version: str = "1.0.0"


def check_service(service: dict) -> ServiceHealth:
    """Check a single service endpoint with retries."""
    name = service["name"]
    url = service["url"]

    if not url or url.endswith("/health") and "SUPABASE_URL" not in os.environ:
        return ServiceHealth(name=name, url=url, status="unknown", error="URL not configured")

    for attempt in range(MAX_RETRIES):
        try:
            start = time.monotonic()
            response = httpx.get(url, timeout=TIMEOUT_SECONDS, follow_redirects=True)
            latency_ms = (time.monotonic() - start) * 1000

            if response.status_code < 400:
                return ServiceHealth(
                    name=name, url=url,
                    status="healthy",
                    http_code=response.status_code,
                    latency_ms=round(latency_ms, 2)
                )
            else:
                return ServiceHealth(
                    name=name, url=url,
                    status="degraded",
                    http_code=response.status_code,
                    latency_ms=round(latency_ms, 2),
                    error=f"HTTP {response.status_code}"
                )
        except httpx.TimeoutException:
            if attempt < MAX_RETRIES - 1:
                time.sleep(2 ** attempt)
                continue
            return ServiceHealth(name=name, url=url, status="down", error="Timeout after retries")
        except Exception as e:
            return ServiceHealth(name=name, url=url, status="down", error=str(e))

    return ServiceHealth(name=name, url=url, status="down", error="Max retries exceeded")


def attempt_heal(service_name: str) -> bool:
    """Attempt to restart a degraded Kubernetes deployment."""
    deployment_map = {
        "devonn-api":      "deployment/devonn-backend",
        "devonn-frontend": "deployment/devonn-frontend",
    }
    deployment = deployment_map.get(service_name)
    if not deployment:
        return False

    print(f"  Attempting to restart {deployment}...")
    try:
        result = subprocess.run(
            ["kubectl", "rollout", "restart", deployment, "-n", "devonn"],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            print(f"  ✓ Restart triggered for {deployment}")
            return True
        else:
            print(f"  ✗ Restart failed: {result.stderr}")
            return False
    except (subprocess.TimeoutExpired, FileNotFoundError):
        print(f"  ✗ kubectl not available or timed out")
        return False


def post_slack_alert(mesh: MeshHealth) -> None:
    """Post a critical alert to Slack."""
    if not SLACK_WEBHOOK:
        return

    down_services = [s.name for s in mesh.services if s.status == "down"]
    degraded_services = [s.name for s in mesh.services if s.status == "degraded"]

    message = {
        "text": f"🔴 *Devonn.AI Mesh Alert* — Status: `{mesh.overall.upper()}`",
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": (
                        f"*Devonn.AI Mesh Health Check Failed*\n"
                        f"Overall: `{mesh.overall.upper()}`\n"
                        f"Down: {', '.join(down_services) or 'none'}\n"
                        f"Degraded: {', '.join(degraded_services) or 'none'}\n"
                        f"Time: {mesh.checked_at}"
                    )
                }
            }
        ]
    }

    try:
        httpx.post(SLACK_WEBHOOK, json=message, timeout=5)
    except Exception:
        pass  # Never let Slack failure crash the health check


def run_health_check(heal: bool = False, json_output: bool = False) -> int:
    """Run the full mesh health check and return exit code."""
    services_health = [check_service(s) for s in SERVICES]

    # Determine overall status
    critical_services = {s["name"] for s in SERVICES if s["critical"]}
    down_critical = [s for s in services_health if s.name in critical_services and s.status == "down"]
    degraded_critical = [s for s in services_health if s.name in critical_services and s.status == "degraded"]

    if down_critical:
        overall = "critical"
    elif degraded_critical:
        overall = "degraded"
    else:
        overall = "healthy"

    mesh = MeshHealth(overall=overall, services=services_health)

    if json_output:
        print(json.dumps(asdict(mesh), indent=2))
    else:
        print(f"\n{'='*60}")
        print(f"  Devonn.AI Mesh Health — {mesh.checked_at}")
        print(f"  Overall: {overall.upper()}")
        print(f"{'='*60}")
        for s in services_health:
            icon = "✅" if s.status == "healthy" else "⚠️" if s.status == "degraded" else "❌" if s.status == "down" else "❓"
            latency = f"{s.latency_ms:.0f}ms" if s.latency_ms else "N/A"
            print(f"  {icon} {s.name:<20} {s.status:<10} {latency:<10} {s.error or ''}")
        print(f"{'='*60}\n")

    # Auto-healing
    if heal and overall in ("critical", "degraded"):
        print("Attempting auto-healing...")
        for s in services_health:
            if s.status in ("down", "degraded"):
                attempt_heal(s.name)

    # Alert on critical state
    if overall == "critical":
        post_slack_alert(mesh)
        return 1

    return 0


def main():
    parser = argparse.ArgumentParser(description="Devonn.AI Mesh Health Monitor")
    parser.add_argument("--heal", action="store_true", help="Attempt auto-healing on failure")
    parser.add_argument("--json", action="store_true", dest="json_output", help="Output JSON")
    args = parser.parse_args()

    sys.exit(run_health_check(heal=args.heal, json_output=args.json_output))


if __name__ == "__main__":
    main()
