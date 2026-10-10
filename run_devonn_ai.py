#!/usr/bin/env python3
"""
run_devonn_ai.py — Hermes orchestrator entry point for the Devonn.ai Auto-Healer Mesh.

This script starts the Hermes event loop which:
  1. Polls the Central Orchestrator for pending agent tasks.
  2. Dispatches tasks to the appropriate AI agent (Security, Debug, Refactor, Performance).
  3. Reports results back to the Orchestrator and opens GitHub PRs/issues as needed.

Environment variables (loaded from .env by run_all.sh):
  GITHUB_TOKEN      — GitHub personal access token
  OPENAI_API_KEY    — OpenAI API key for agent LLM calls
  ORCHESTRATOR_URL  — Central Orchestrator base URL (default: https://central-orchestrator.onrender.com)
  GATEWAY_URL       — OpenClaw Gateway base URL (default: https://openclaw-gateway-2t9e.onrender.com)
  ORGANIZATION      — GitHub org/user (default: wesship)
  POLL_INTERVAL     — Seconds between polls (default: 30)
"""
import os
import time
import json
import logging
import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [Hermes] %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("hermes")

ORCHESTRATOR_URL = os.environ.get("ORCHESTRATOR_URL", "https://central-orchestrator.onrender.com")
GATEWAY_URL = os.environ.get("GATEWAY_URL", "https://openclaw-gateway-2t9e.onrender.com")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
ORGANIZATION = os.environ.get("ORGANIZATION", "wesship")
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "30"))

HEADERS = {"Authorization": f"Bearer {GITHUB_TOKEN}", "Content-Type": "application/json"}


def check_services() -> bool:
    """Verify both cloud services are reachable before starting the loop."""
    ok = True
    for name, url in [("Orchestrator", ORCHESTRATOR_URL), ("Gateway", GATEWAY_URL)]:
        try:
            r = requests.get(f"{url}/health", timeout=10)
            if r.status_code == 200:
                log.info("%s healthy — %s", name, r.json().get("status", "ok"))
            else:
                log.warning("%s returned HTTP %s", name, r.status_code)
                ok = False
        except Exception as exc:
            log.error("%s unreachable: %s", name, exc)
            ok = False
    return ok


def poll_queue() -> list:
    """Fetch pending tasks from the Orchestrator queue."""
    try:
        r = requests.get(f"{ORCHESTRATOR_URL}/queue", timeout=10)
        if r.status_code == 200:
            return r.json().get("tasks", [])
    except Exception as exc:
        log.warning("Queue poll failed: %s", exc)
    return []


def dispatch_task(task: dict) -> None:
    """Send a task to the Gateway for agent dispatch."""
    try:
        r = requests.post(
            f"{GATEWAY_URL}/webhook",
            json=task,
            headers=HEADERS,
            timeout=15,
        )
        log.info("Dispatched task %s — HTTP %s", task.get("id", "?"), r.status_code)
    except Exception as exc:
        log.error("Dispatch failed for task %s: %s", task.get("id", "?"), exc)


def main() -> None:
    log.info("Hermes orchestrator starting up...")
    log.info("Orchestrator: %s", ORCHESTRATOR_URL)
    log.info("Gateway:      %s", GATEWAY_URL)
    log.info("Org:          %s", ORGANIZATION)
    log.info("Poll interval: %ss", POLL_INTERVAL)

    if not check_services():
        log.warning("One or more services unreachable — continuing anyway, will retry each poll.")

    log.info("Entering event loop...")
    while True:
        try:
            tasks = poll_queue()
            if tasks:
                log.info("Found %d pending task(s)", len(tasks))
                for task in tasks:
                    dispatch_task(task)
            else:
                log.debug("Queue empty — sleeping %ss", POLL_INTERVAL)
        except KeyboardInterrupt:
            log.info("Hermes shutting down.")
            break
        except Exception as exc:
            log.error("Unexpected error in event loop: %s", exc)
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
