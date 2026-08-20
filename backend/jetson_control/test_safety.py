from datetime import datetime, timedelta, timezone

from .contracts import Capability, CommandKind, ControlCommand, DeviceClass, DeviceProfile, DeviceState
from .safety import evaluate_command

NOW = datetime(2026, 8, 20, 20, 0, tzinfo=timezone.utc)


def device(state=DeviceState.ONLINE, capabilities=frozenset()):
    return DeviceProfile(
        device_id="device-01",
        device_class=DeviceClass.SMART_GLASSES,
        model_family="meta-smart-glasses",
        firmware_version="test",
        state=state,
        capabilities=capabilities,
    )


def command(kind=CommandKind.HEALTH_CHECK, expires=None, device_id="device-01"):
    return ControlCommand(
        command_id="cmd-1",
        device_id=device_id,
        kind=kind,
        issued_at=NOW - timedelta(seconds=1),
        expires_at=expires or NOW + timedelta(seconds=30),
        actor_id="operator-1",
        request_id="req-1",
        payload={},
    )


def test_rejects_revoked_device():
    assert not evaluate_command(command(), device(DeviceState.REVOKED), actor_authorized=True, now=NOW).allowed


def test_rejects_privacy_locked_device():
    assert not evaluate_command(command(), device(DeviceState.PRIVACY_LOCKED), actor_authorized=True, now=NOW).allowed


def test_rejects_expired_command():
    assert not evaluate_command(command(expires=NOW - timedelta(seconds=1)), device(), actor_authorized=True, now=NOW).allowed


def test_rejects_unauthorized_actor():
    assert not evaluate_command(command(), device(), actor_authorized=False, now=NOW).allowed


def test_allows_standard_command_after_gates():
    decision = evaluate_command(command(), device(), actor_authorized=True, now=NOW)
    assert decision.allowed is True
    assert decision.safety_class == "standard"


def test_rejects_display_without_capability():
    decision = evaluate_command(command(CommandKind.DISPLAY_NOTIFICATION), device(), actor_authorized=True, now=NOW)
    assert decision.allowed is False


def test_rejects_capture_without_sensitive_approval():
    glasses = device(capabilities=frozenset({Capability.IMAGE_CAPTURE}))
    decision = evaluate_command(command(CommandKind.CAPTURE_IMAGE), glasses, actor_authorized=True, now=NOW)
    assert decision.allowed is False


def test_allows_approved_capture():
    glasses = device(capabilities=frozenset({Capability.IMAGE_CAPTURE}))
    decision = evaluate_command(
        command(CommandKind.CAPTURE_IMAGE), glasses, actor_authorized=True,
        approved_sensitive_action=True, now=NOW,
    )
    assert decision.allowed is True
    assert decision.safety_class == "sensitive"


def test_requires_high_impact_approval():
    jetson = device(capabilities=frozenset({Capability.EDGE_INFERENCE}))
    decision = evaluate_command(command(CommandKind.REBOOT), jetson, actor_authorized=True, now=NOW)
    assert decision.allowed is False
    assert decision.safety_class == "high-impact"


def test_allows_approved_high_impact_command():
    jetson = device(capabilities=frozenset({Capability.EDGE_INFERENCE}))
    decision = evaluate_command(
        command(CommandKind.REBOOT), jetson, actor_authorized=True,
        approved_high_impact_action=True, now=NOW,
    )
    assert decision.allowed is True
