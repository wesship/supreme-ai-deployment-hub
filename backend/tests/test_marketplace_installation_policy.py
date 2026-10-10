import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from backend.marketplace.installations import InstallationRequest, installation_row


def registry(**overrides):
    row = {"id": "agent-123", "status": "active", "capabilities": ["hermes", "publish"]}
    row.update(overrides)
    return row


def test_server_sets_owner_and_runtime_fields():
    request = InstallationRequest(agent_id="agent-123", name="Hermes One", environment="staging")
    row = installation_row(user_id="user-a", request=request, registry_row=registry())
    assert row["user_id"] == "user-a"
    assert row["template_id"] == "agent-123"
    assert row["status"] == "starting"
    assert "health_score" not in row
    assert "last_heartbeat" not in row
    assert "cpu_usage" not in row
    assert "memory_usage" not in row
    assert "total_runs" not in row


def test_rejects_noncanonical_registry_identity():
    request = InstallationRequest(agent_id="agent-evil", name="Agent")
    with pytest.raises(HTTPException) as exc:
        installation_row(user_id="user-a", request=request, registry_row=registry())
    assert exc.value.status_code == 409


def test_rejects_inactive_agent():
    request = InstallationRequest(agent_id="agent-123", name="Agent")
    with pytest.raises(HTTPException) as exc:
        installation_row(user_id="user-a", request=request, registry_row=registry(status="disabled"))
    assert exc.value.status_code == 404


@pytest.mark.parametrize("environment", ["prod-now", "root", ""])
def test_rejects_unknown_environment(environment):
    with pytest.raises(ValidationError):
        InstallationRequest(agent_id="agent-123", name="Agent", environment=environment)


def test_rejects_arbitrary_capability():
    with pytest.raises(ValidationError):
        InstallationRequest(agent_id="agent-123", name="Agent", enabled_tools=["shell-root"])


def test_rejects_unknown_notification_channel():
    with pytest.raises(ValidationError):
        InstallationRequest(agent_id="agent-123", name="Agent", notifications={"webhook": "https://example.invalid"})
