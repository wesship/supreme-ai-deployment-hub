"""Deterministic simulated device adapter for Jetson Control E2E tests."""

from __future__ import annotations

from typing import Any

from .contracts import CommandKind, ControlCommand


class SimulatedDeviceAdapter:
    """Safe test double; it never communicates with physical hardware."""

    def __init__(self) -> None:
        self.commands: list[str] = []

    async def dispatch(self, command: ControlCommand) -> dict[str, Any]:
        self.commands.append(command.command_id)
        return {
            "accepted": True,
            "simulated": True,
            "command_id": command.command_id,
            "kind": command.kind.value,
            "message": "simulated device execution completed",
        }
