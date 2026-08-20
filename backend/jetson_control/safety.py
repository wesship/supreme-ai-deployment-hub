"""Pure safety gates for Jetson Control commands."""

from __future__ import annotations

from datetime import datetime, timezone

from .contracts import (
    CommandDecision,
    ControlCommand,
    DeviceState,
    HIGH_IMPACT_COMMANDS,
)


def evaluate_command(
    command: ControlCommand,
    device_state: DeviceState,
    *,
    actor_authorized: bool,
    now: datetime | None = None,
) -> CommandDecision:
    """Return a deny-by-default decision for a remote device command."""

    now = now or datetime.now(timezone.utc)

    if not command.command_id or not command.request_id or not command.actor_id:
        return CommandDecision(False, "missing command identity", "deny")

    if command.expires_at <= command.issued_at:
        return CommandDecision(False, "invalid command expiry", "deny")

    if now >= command.expires_at:
        return CommandDecision(False, "command expired", "deny")

    if device_state in {DeviceState.REVOKED, DeviceState.QUARANTINED}:
        return CommandDecision(False, "device is not commandable", "deny")

    if not actor_authorized:
        return CommandDecision(False, "actor is not authorized", "deny")

    if command.kind in HIGH_IMPACT_COMMANDS:
        # High-impact actions require an additional policy decision at the
        # adapter/API boundary. This function never grants that elevation.
        return CommandDecision(True, "authorized for high-impact policy review", "high-impact")

    return CommandDecision(True, "command passed domain safety gates", "standard")
