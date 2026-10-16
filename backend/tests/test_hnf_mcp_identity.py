"""Pure unit tests for HNF MCP identity verification.

These tests do not establish that the HTTP route uses the guard.
"""
import pytest

from backend.hnf.mcp_identity import MCPIdentityError, verify_mcp_service_identity


def test_missing_config_rejected():
    with pytest.raises(MCPIdentityError, match="not configured"):
        verify_mcp_service_identity({}, configured_actor_id="")


def test_service_identity_derived_from_configuration():
    identity = verify_mcp_service_identity(
        {"request_id": "example-request"}, configured_actor_id="hnf-mcp-gateway"
    )
    assert identity.actor_id == "hnf-mcp-gateway"
    assert identity.actor_type == "service"


def test_matching_legacy_actor_accepted():
    identity = verify_mcp_service_identity(
        {"actor_id": "hnf-mcp-gateway", "actor_type": "service"},
        configured_actor_id="hnf-mcp-gateway",
    )
    assert identity.actor_id == "hnf-mcp-gateway"


@pytest.mark.parametrize("claimed_actor", ["admin", "another-user", "", None])
def test_actor_spoofing_rejected(claimed_actor):
    with pytest.raises(MCPIdentityError, match="does not match"):
        verify_mcp_service_identity(
            {"actor_id": claimed_actor}, configured_actor_id="hnf-mcp-gateway"
        )


@pytest.mark.parametrize("claimed_type", ["user", "agent", "", None])
def test_type_spoofing_rejected(claimed_type):
    with pytest.raises(MCPIdentityError, match="cannot assert"):
        verify_mcp_service_identity(
            {"actor_type": claimed_type}, configured_actor_id="hnf-mcp-gateway"
        )
