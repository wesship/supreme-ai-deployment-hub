from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "deploy_vapi_call_center.py"
spec = importlib.util.spec_from_file_location("deploy_vapi_call_center", SCRIPT)
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)


def manifest():
    members = []
    for key in module.ROUTES:
        members.append(
            {
                "key": key,
                "assistant": {
                    "name": f"D3VONN {'Front Desk / Router' if key == 'front_desk' else key.replace('_', ' ').title()}",
                    "model": {
                        "provider": "openai",
                        "model": "gpt-4.1-mini",
                        "messages": [{"role": "system", "content": "test"}],
                        "tools": [
                            {
                                "type": "function",
                                "function": {
                                    "name": "lookup_customer",
                                    "description": "Lookup customer",
                                    "parameters": {
                                        "type": "object",
                                        "properties": {"email": {"type": "string"}},
                                    },
                                },
                            }
                        ]
                        if key == "front_desk"
                        else [],
                    },
                    "voice": {"provider": "11labs", "voiceId": "voice"},
                },
            }
        )
    return {"name": "D3VONN Agentic Call Center", "members": members}


def test_builder_converts_function_tools_to_secured_api_request_tools():
    payload = module.build_deployable_squad(
        manifest(), backend_url="https://api.d3vonn.io", credential_id="cred-123"
    )
    module.validate_squad(payload)
    assert len(payload["members"]) == 7
    first = payload["members"][0]
    tool = first["assistant"]["model"]["tools"][0]
    assert tool["type"] == "apiRequest"
    assert tool["credentialId"] == "cred-123"
    assert tool["url"].endswith("/api/voice/call-center/tools/lookup_customer")
    static = {item["key"]: item["value"] for item in tool["parameters"]}
    assert static["call_id"] == "{{ call.id }}"
    assert static["agent"] == "front_desk"
    assert tool["body"]["properties"]["parameters"]["properties"]["email"]["type"] == "string"


def test_builder_adds_governed_handoff_destinations():
    payload = module.build_deployable_squad(
        manifest(), backend_url="https://api.d3vonn.io", credential_id="cred-123"
    )
    first = payload["members"][0]
    destinations = first["assistantDestinations"]
    assert len(destinations) == 6
    assert all(item["transferMode"] == "rolling-history" for item in destinations)
    assert {item["name"] for item in destinations} == {
        "handoff_to_sales",
        "handoff_to_support",
        "handoff_to_scheduling",
        "handoff_to_billing",
        "handoff_to_retention",
        "handoff_to_human_handoff",
    }


def test_front_desk_is_first_member():
    payload = module.build_deployable_squad(
        manifest(), backend_url="https://api.d3vonn.io", credential_id="cred-123"
    )
    assert payload["members"][0]["assistant"]["name"].startswith("D3VONN Front Desk")


def test_missing_credential_fails_closed():
    with pytest.raises(ValueError, match="CREDENTIAL_ID"):
        module.build_deployable_squad(manifest(), backend_url="https://api.d3vonn.io", credential_id="")


def test_member_contract_drift_fails_closed():
    broken = manifest()
    broken["members"] = broken["members"][:-1]
    with pytest.raises(ValueError, match="seven"):
        module.build_deployable_squad(
            broken, backend_url="https://api.d3vonn.io", credential_id="cred-123"
        )
