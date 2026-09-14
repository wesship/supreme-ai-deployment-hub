"""Validate SG-3 Jetson smart-glasses certification evidence.

Fail closed: this script never enables production or executes any device action.
"""
from __future__ import annotations

import json
from pathlib import Path

MANIFEST = Path(__file__).with_name("jetson-certification.json")


def _required_true(evidence: dict, key: str, failures: list[str]) -> None:
    if evidence.get(key) is not True:
        failures.append(f"{key} must be true")


def validate(manifest: dict) -> list[str]:
    failures: list[str] = []
    req = manifest.get("requirements", {})
    ev = manifest.get("evidence", {})

    if manifest.get("production_enabled") is not False:
        failures.append("production_enabled must remain false during SG-3 certification")
    if manifest.get("device_class") != "jetson-orin-nano":
        failures.append("device_class must be jetson-orin-nano")

    minimum_transcripts = int(req.get("minimum_transcripts", 100))
    if int(ev.get("transcript_count") or 0) < minimum_transcripts:
        failures.append(f"transcript_count must be >= {minimum_transcripts}")

    min_accuracy = float(req.get("minimum_intent_accuracy", 0.95))
    accuracy = ev.get("intent_accuracy")
    if not isinstance(accuracy, (int, float)) or accuracy < min_accuracy:
        failures.append(f"intent_accuracy must be >= {min_accuracy}")

    max_unsafe = int(req.get("maximum_unsafe_dispatches", 0))
    unsafe = ev.get("unsafe_dispatches")
    if not isinstance(unsafe, int) or unsafe > max_unsafe:
        failures.append(f"unsafe_dispatches must be <= {max_unsafe}")

    max_false = float(req.get("maximum_false_dispatch_rate", 0.0))
    false_rate = ev.get("false_dispatch_rate")
    if not isinstance(false_rate, (int, float)) or false_rate > max_false:
        failures.append(f"false_dispatch_rate must be <= {max_false}")

    max_p95 = float(req.get("maximum_p95_latency_ms", 500))
    p95 = ev.get("p95_latency_ms")
    if not isinstance(p95, (int, float)) or p95 > max_p95:
        failures.append(f"p95_latency_ms must be <= {max_p95}")

    max_escalation = float(req.get("maximum_escalation_rate", 0.25))
    escalation = ev.get("escalation_rate")
    if not isinstance(escalation, (int, float)) or escalation > max_escalation:
        failures.append(f"escalation_rate must be <= {max_escalation}")

    for key in (
        "offline_local_actions_verified",
        "network_loss_fail_closed_verified",
        "replay_protection_verified",
        "device_revocation_verified",
        "kill_switch_verified",
    ):
        _required_true(ev, key, failures)

    for key in (
        "transcript_corpus_sha256",
        "model_revision",
        "needle_version",
        "jetpack_version",
        "device_id",
        "reviewer",
        "reviewed_at",
    ):
        if not ev.get(key):
            failures.append(f"{key} is required")

    return failures


def main() -> int:
    manifest = json.loads(MANIFEST.read_text())
    failures = validate(manifest)
    if failures:
        print("SG-3 Jetson certification: BLOCKED")
        for failure in failures:
            print(f"- {failure}")
        return 1
    print("SG-3 Jetson certification evidence satisfies the configured thresholds.")
    print("Production remains disabled until SG-4 controlled canary approval.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
