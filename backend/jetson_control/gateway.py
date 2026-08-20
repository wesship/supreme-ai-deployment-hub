"""Backend-only Jetson/smart-glasses command gateway.

This module provides a transport-neutral gateway boundary. It validates a
command before a device adapter is allowed to execute it. No browser-facing
code should call a device adapter directly.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Protocol

from .contracts import CommandDecision, ControlCommand, DeviceProfile
from .safety import evaluate_command


class DeviceAdapter(Protocol):
    async def dispatch(self, command: ControlCommand) -> dict[str, Any]: ...


class GatewayDenied(Exception):
    """Raised when a command fails a gateway safety gate."""


@dataclass(frozen=True, slots=True)
class GatewayResult:
    command_id: str
    dispatched: bool
    decision: CommandDecision
    result: dict[str, Any] | None = None


async def dispatch_command(
    command: ControlCommand,
    device: DeviceProfile,
    adapter: DeviceAdapter,
    *,
    actor_authorized: bool,
    approved_sensitive_action: bool = False,
    approved_high_impact_action: bool = False,
    now: datetime | None = None,
) -> GatewayResult:
    """Validate then dispatch exactly once through the supplied adapter.

    Persistence/idempotency belongs to the service layer around this pure
    adapter boundary. A caller must persist the command before dispatch and
    persist the returned result/audit event after execution.
    """

    decision = evaluate_command(
        command,
        device,
        actor_authorized=actor_authorized,
        now=now or datetime.now(timezone.utc),
        approved_sensitive_action=approved_sensitive_action,
        approved_high_impact_action=approved_high_impact_action,
    )

    if not decision.allowed:
        raise GatewayDenied(decision.reason)

    result = await adapter.dispatch(command)
    return GatewayResult(command.command_id, True, decision, result)
