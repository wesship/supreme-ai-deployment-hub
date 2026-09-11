from datetime import datetime, timedelta, timezone

from .contracts import Capability, CommandKind, ControlCommand, DeviceClass, DeviceProfile, DeviceState
from .safety import evaluate_command

NOW = datetime(2026, 8, 20, 20, 0, tzinfo=timezone.utc)


def device(state=DeviceState.ONLINE, capabilities=frozenset()):
    return DeviceProfile(
        device_id="device-01",
        device_class=DeviceClass.SMART_GLASSES,
        model_family="test-device",
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


def test_rejects_revoked_privacy_locked_expired_and_unauthorized():
    assert not evaluate_command(command(), device(DeviceState.REVOKED), actor_authorized=True, now=NOW).allowed
    assert not evaluate_command(command(), device(DeviceState.PRIVACY_LOCKED), actor_authorized=True, now=NOW).allowed
    assert not evaluate_command(command(expires=NOW - timedelta(seconds=1)), device(), actor_authorized=True, now=NOW).allowed
    assert not evaluate_command(command(), device(), actor_authorized=False, now=NOW).allowed


def test_standard_command_passes_after_identity_and_auth_gates():
    decision = evaluate_command(command(), device(), actor_authorized=True, now=NOW)
    assert decision.allowed is True
    assert decision.safety_class == "standard"


def test_sensitive_capture_requires_capability_and_explicit_approval():
    assert not evaluate_command(command(CommandKind.CAPTURE_IMAGE), device(), actor_authorized=True, now=NOW).allowed
    glasses = device(capabilities=frozenset({Capability.IMAGE_CAPTURE}))
    assert not evaluate_command(command(CommandKind.CAPTURE_IMAGE), glasses, actor_authorized=True, now=NOW).allowed
    decision = evaluate_command(
        command(CommandKind.CAPTURE_IMAGE),
        glasses,
        actor_authorized=True,
        approved_sensitive_action=True,
        now=NOW,
    )
    assert decision.allowed is True
    assert decision.safety_class == "sensitive"


def test_high_impact_command_requires_explicit_approval():
    jetson = device(capabilities=frozenset({Capability.EDGE_INFERENCE}))
    denied = evaluate_command(command(CommandKind.REBOOT), jetson, actor_authorized=True, now=NOW)
    allowed = evaluate_command(
        command(CommandKind.REBOOT),
        jetson,
        actor_authorized=True,
        approved_high_impact_action=True,
        now=NOW,
    )
    assert denied.allowed is False
    assert denied.safety_class == "high-impact"
    assert allowed.allowed is True
