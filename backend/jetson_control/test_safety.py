from datetime import datetime, timedelta, timezone

from .contracts import CommandKind, ControlCommand, DeviceState
from .safety import evaluate_command


NOW = datetime(2026, 8, 20, 20, 0, tzinfo=timezone.utc)


def command(kind=CommandKind.HEALTH_CHECK, expires=None):
    return ControlCommand(
        command_id="cmd-1",
        device_id="jetson-01",
        kind=kind,
        issued_at=NOW - timedelta(seconds=1),
        expires_at=expires or NOW + timedelta(seconds=30),
        actor_id="operator-1",
        request_id="req-1",
        payload={},
    )


def test_rejects_revoked_device():
    decision = evaluate_command(command(), DeviceState.REVOKED, actor_authorized=True, now=NOW)
    assert decision.allowed is False


def test_rejects_expired_command():
    decision = evaluate_command(
        command(expires=NOW - timedelta(seconds=1)),
        DeviceState.ONLINE,
        actor_authorized=True,
        now=NOW,
    )
    assert decision.allowed is False


def test_rejects_unauthorized_actor():
    decision = evaluate_command(command(), DeviceState.ONLINE, actor_authorized=False, now=NOW)
    assert decision.allowed is False


def test_allows_standard_command_after_gates():
    decision = evaluate_command(command(), DeviceState.ONLINE, actor_authorized=True, now=NOW)
    assert decision.allowed is True
    assert decision.safety_class == "standard"


def test_marks_high_impact_for_additional_policy_review():
    decision = evaluate_command(
        command(CommandKind.REBOOT), DeviceState.ONLINE, actor_authorized=True, now=NOW
    )
    assert decision.allowed is True
    assert decision.safety_class == "high-impact"
