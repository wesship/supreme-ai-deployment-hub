from backend.agents.governance import RiskLevel
from backend.agents.tool_registry import (
    DataSensitivity,
    SideEffectClass,
    ToolDefinition,
    ToolRegistry,
    governance_fields_for_tool,
)


def test_registry_rejects_duplicate_names():
    registry = ToolRegistry()
    tool = ToolDefinition(name="crm.read", description="Read CRM records")
    registry.register(tool)

    try:
        registry.register(tool)
    except ValueError as error:
        assert "already registered" in str(error)
    else:
        raise AssertionError("expected duplicate tool registration to fail")


def test_disabled_tool_fails_closed():
    registry = ToolRegistry(
        [ToolDefinition(name="email.send", description="Send email", enabled=False)]
    )

    try:
        registry.require("email.send")
    except PermissionError as error:
        assert "disabled" in str(error)
    else:
        raise AssertionError("expected disabled tool to fail closed")


def test_agent_allowlist_is_enforced():
    registry = ToolRegistry(
        [
            ToolDefinition(
                name="policy.quote",
                description="Request an insurance quote",
                allowed_agents={"insurance-agent"},
            )
        ]
    )

    assert registry.require_for_agent("policy.quote", "insurance-agent").name == "policy.quote"

    try:
        registry.require_for_agent("policy.quote", "marketing-agent")
    except PermissionError as error:
        assert "not allowed" in str(error)
    else:
        raise AssertionError("expected agent allowlist violation to fail")


def test_registry_derives_governance_inputs_from_trusted_metadata():
    tool = ToolDefinition(
        name="email.send",
        description="Send a customer email",
        required_permissions=["communications.send"],
        risk_level=RiskLevel.HIGH,
        side_effect_class=SideEffectClass.COMMUNICATION,
        data_sensitivity=DataSensitivity.CONFIDENTIAL,
    )

    fields = governance_fields_for_tool(tool)

    assert fields["required_permissions"] == ["communications.send"]
    assert fields["risk_level"] is RiskLevel.HIGH
    assert fields["external_side_effect"] is True
    assert fields["contains_sensitive_data"] is True


def test_list_enabled_is_stable_and_excludes_disabled_tools():
    registry = ToolRegistry(
        [
            ToolDefinition(name="z.read", description="Z", enabled=True),
            ToolDefinition(name="a.read", description="A", enabled=True),
            ToolDefinition(name="m.write", description="M", enabled=False),
        ]
    )

    assert [tool.name for tool in registry.list_enabled()] == ["a.read", "z.read"]
