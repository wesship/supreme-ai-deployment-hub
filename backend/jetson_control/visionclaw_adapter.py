"""Transport-neutral VisionClaw adapter contract.

The implementation intentionally contains no Meta credentials or private API
calls. A platform client supplies the supported VisionClaw/DAT transport.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from .contracts import ControlCommand, DeviceProfile, DeviceTelemetry
from .gateway import DeviceAdapter


class VisionClawTransport(Protocol):
    async def send_command(self, command: ControlCommand) -> dict[str, Any]: ...

    async def get_device_profile(self, device_id: str) -> DeviceProfile: ...

    async def get_telemetry(self, device_id: str) -> DeviceTelemetry: ...


@dataclass(frozen=True, slots=True)
class VisionClawAdapter(DeviceAdapter):
    """D3VONN-facing adapter around an approved VisionClaw transport."""

    transport: VisionClawTransport

    async def dispatch(self, command: ControlCommand) -> dict[str, Any]:
        return await self.transport.send_command(command)

    async def discover(self, device_id: str) -> DeviceProfile:
        return await self.transport.get_device_profile(device_id)

    async def telemetry(self, device_id: str) -> DeviceTelemetry:
        return await self.transport.get_telemetry(device_id)
