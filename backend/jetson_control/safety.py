"""Pure deny-by-default safety gates for Jetson and smart-glasses commands."""

from __future__ import annotations

from datetime import datetime, timezone

from .contracts import (
    Capability,
    CommandDecision,
    CommandKind,
    ControlCommand,
    DeviceProfile,
    DeviceState,
    HIGH_IMPACT_COMMANDS,
    SENSITIVE_COMMANDS,
)


def evaluate_command(
    command: ControlCommand,
    device: DeviceProfile,
    *,
    actor_authorized: bool,
    now: datetime | None = None,
    approved_sensitive_action: bool = False,
    approved_high_impact_action: bool = False,
) -> CommandDecision:
    now = now or datetime.now(timezone.utc)

    if not command.command_id or not command.request_id or not command.actor_id:
        return CommandDecision(False, "missing command identity", "deny")
    if command.device_id != device.device_id:
        return CommandDecision(False, "device identity mismatch", "deny")
    if command.expires_at <= command.issued_at:
        return CommandDecision(False, "invalid command expiry", "deny")
    if now >= command.expires_at:
        return CommandDecision(False, "command expired", "deny")
    if device.state in {DeviceState.REVOKED, DeviceState.QUARANTINED, DeviceState.PRIVACY_LOCKED}:
        return CommandDecision(False, "device is not commandable", "deny")
    if not actor_authorized:
        return CommandDecision(False, "actor is not authorized", "deny")

    required_capability = {
        CommandKind.DISPLAY_NOTIFICATION: Capability.DISPLAY,
        CommandKind.AUDIO_NOTIFICATION: Capability.AUDIO_OUTPUT,
        CommandKind.CAPTURE_IMAGE: Capability.IMAGE_CAPTURE,
        CommandKind.START_CAPTURE: Capability.VIDEO_CAPTURE,
        CommandKind.STOP_CAPTURE: Capability.VIDEO_CAPTURE,
        CommandKind.START_VISION_PIPELINE: Capability.EDGE_INFERENCE,
        CommandKind.STOP_VISION_PIPELINE: Capability.EDGE_INFERENCE,
        CommandKind.DEPLOY_MODEL: Capability.EDGE_INFERENCE,
        CommandKind.REBOOT: Capability.EDGE_INFERENCE,
    }.get(command.kind)

    if required_capability and required_capability not in device.capabilities:
        return CommandDecision(False, "device capability is unavailable", "deny")
    if command.kind in SENSITIVE_COMMANDS and not approved_sensitive_action:
        return CommandDecision(False, "sensitive action requires explicit approval", "sensitive")
    if command.kind in HIGH_IMPACT_COMMANDS and not approved_high_impact_action:
        return CommandDecision(False, "high-impact action requires explicit approval", "high-impact")
    if command.kind in SENSITIVE_COMMANDS:
        return CommandDecision(True, "approved sensitive action passed safety gates", "sensitive")
    if command.kind in HIGH_IMPACT_COMMANDS:
        return CommandDecision(True, "approved high-impact action passed safety gates", "high-impact")
    return CommandDecision(True, "command passed domain safety gates", "standard")
