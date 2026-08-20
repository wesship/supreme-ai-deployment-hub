from datetime import datetime, timedelta, timezone

import pytest

from .contracts import Capability, CommandKind, ControlCommand, DeviceClass, DeviceProfile, DeviceState
from .gateway import GatewayDenied, dispatch_command
from .simulated_adapter import SimulatedDeviceAdapter


NOW = datetime(2026, 8, 20, 20, 0, tzinfo=timezone.utc)


def profile(*capabilities: Capability, state: DeviceState = DeviceState.ONLINE) -> DeviceProfile:
    return DeviceProfile(
        device_id="glasses-01",
        device_class=DeviceClass.SMART_GLASSES,
        model_family="ray-ban-meta",
        firmware_version="test",
        capabilities=frozenset(capabilities),
        state=state,
        companion_device_id="phone-01",
    )


def command(kind: CommandKind) -> ControlCommand:
    return ControlCommand(
        command_id="cmd-1",
        device_id="glasses-01",
        kind=kind,
        issued_at=NOW - timedelta(seconds=1),
        expires_at=NOW + timedelta(seconds=30),
        actor_id="operator-1",
        request_id="req-1",
        payload={},
    )


@pytest.mark.asyncio
async def test_simulated_display_command_completes():
    adapter = SimulatedDeviceAdapter()
    result = await dispatch_command(
        command(CommandKind.DISPLAY_NOTIFICATION),
        profile(Capability.DISPLAY),
        adapter,
        actor_authorized=True,
        now=NOW,
    )
    assert result.dispatched is True
    assert result.result["simulated"] is True
    assert adapter.commands == ["cmd-1"]


@pytest.mark.asyncio
async def test_capture_requires_explicit_sensitive_approval():
    with pytest.raises(GatewayDenied):
        await dispatch_command(
            command(CommandKind.CAPTURE_IMAGE),
            profile(Capability.IMAGE_CAPTURE),
            SimulatedDeviceAdapter(),
            actor_authorized=True,
            now=NOW,
        )


@pytest.mark.asyncio
async def test_capture_dispatches_after_sensitive_approval():
    adapter = SimulatedDeviceAdapter()
    result = await dispatch_command(
        command(CommandKind.CAPTURE_IMAGE),
        profile(Capability.IMAGE_CAPTURE),
        adapter,
        actor_authorized=True,
        approved_sensitive_action=True,
        now=NOW,
    )
    assert result.dispatched is True
    assert result.decision.safety_class == "sensitive"


@pytest.mark.asyncio
async def test_missing_capability_is_denied_before_adapter():
    adapter = SimulatedDeviceAdapter()
    with pytest.raises(GatewayDenied):
        await dispatch_command(
            command(CommandKind.DISPLAY_NOTIFICATION),
            profile(Capability.AUDIO_OUTPUT),
            adapter,
            actor_authorized=True,
            now=NOW,
        )
    assert adapter.commands == []
