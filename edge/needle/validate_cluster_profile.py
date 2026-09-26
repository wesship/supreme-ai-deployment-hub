"""Validate the declarative D3VONN Needle smart-glasses cluster profile.

This validator is intentionally fail-closed and does not enable production,
execute device actions, or alter SG-3/SG-4 certification state.
"""
from __future__ import annotations

import json
from pathlib import Path

PROFILE = Path(__file__).with_name("cluster-profile.json")

EXPECTED_LOCAL = {"capture_photo", "get_battery"}
EXPECTED_GATEWAY = {"describe_scene", "read_text", "create_note", "ask_d3vonn", "recall_memory"}
EXPECTED_PRIVILEGED = {"start_recording", "stop_recording", "get_location", "delete_data", "send_money"}
EXPECTED_OFFLOAD = {
    "vision": "jetson-orin-nano",
    "reasoning": "d3vonn-gateway",
    "memory": "d3vonn-gateway",
    "privileged_actions": "guardian-review",
}

REQUIRED_CAPABILITIES = {
    "camera",
    "microphone",
    "audio_output",
    "display",
    "battery_status",
    "vision_stream",
    "voice_command",
}

REQUIRED_SECURITY = {
    "signed_device_envelope_required",
    "replay_protection_required",
    "revocation_required",
    "audit_logging_required",
    "kill_switch_required",
}


def validate(profile: dict) -> list[str]:
    failures: list[str] = []

    if profile.get("production_enabled") is not False:
        failures.append("production_enabled must remain false")
    if profile.get("device_class") != "smart-glasses":
        failures.append("device_class must be smart-glasses")
    if profile.get("role") != "human-edge-interface":
        failures.append("role must be human-edge-interface")
    if profile.get("inference_target") != "jetson-orin-nano":
        failures.append("inference_target must be jetson-orin-nano")
    if profile.get("control_plane") != "d3vonn-gateway":
        failures.append("control_plane must be d3vonn-gateway")

    capabilities = profile.get("capabilities", {})
    for key in sorted(REQUIRED_CAPABILITIES):
        if capabilities.get(key) is not True:
            failures.append(f"capabilities.{key} must be true")

    routing = profile.get("routing", {})
    if set(routing.get("local", [])) != EXPECTED_LOCAL:
        failures.append("routing.local does not match Needle local tools")
    if set(routing.get("d3vonn_gateway", [])) != EXPECTED_GATEWAY:
        failures.append("routing.d3vonn_gateway does not match Needle remote tools")
    if set(routing.get("guardian_review", [])) != EXPECTED_PRIVILEGED:
        failures.append("routing.guardian_review does not match Needle privileged tools")

    offload = profile.get("offload")
    if not isinstance(offload, dict) or offload != EXPECTED_OFFLOAD:
        failures.append("offload must match approved cluster targets")

    security = profile.get("security", {})
    for key in sorted(REQUIRED_SECURITY):
        if security.get(key) is not True:
            failures.append(f"security.{key} must be true")
    if security.get("secrets_in_image") is not False:
        failures.append("security.secrets_in_image must be false")

    gates = profile.get("gates", {})
    if gates.get("sg3_jetson_certification_required") is not True:
        failures.append("SG-3 certification must remain required")
    if gates.get("sg4_controlled_canary_required") is not True:
        failures.append("SG-4 canary must remain required")

    return failures


def main() -> int:
    profile = json.loads(PROFILE.read_text())
    failures = validate(profile)
    if failures:
        print("Needle cluster profile: BLOCKED")
        for failure in failures:
            print(f"- {failure}")
        return 1
    print("Needle cluster profile: VALID")
    print("Production remains disabled pending SG-3 and SG-4 evidence.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
