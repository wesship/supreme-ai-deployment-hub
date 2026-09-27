from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / "integrations" / "the-door-unreal" / "RetroDoorXR"
SUBSYSTEM = PLUGIN / "Source" / "RetroDoorXR" / "Private" / "DoorXRSubsystem.cpp"
PROVIDER = PLUGIN / "Source" / "RetroDoorXR" / "Public" / "MetaDoorXRProvider.h"
BUILD = PLUGIN / "Source" / "RetroDoorXR" / "RetroDoorXR.Build.cs"
README = PLUGIN / "README.md"


def test_unreal_xr_plugin_scaffold_exists():
    assert (PLUGIN / "RetroDoorXR.uplugin").exists()
    assert BUILD.exists()
    assert SUBSYSTEM.exists()
    assert PROVIDER.exists()


def test_xr_client_calls_governed_backend_and_never_loads_levels():
    source = SUBSYSTEM.read_text()
    assert "/api/the-door/xr/interactions" in source
    assert "authorize_in_game" in source
    assert "OnDoorAuthorizationRequired.Broadcast" in source
    assert "OpenLevel" not in source
    assert "LoadLevel" not in source


def test_meta_provider_fails_closed_until_runtime_ready():
    source = PROVIDER.read_text()
    assert "bRuntimeReady = false" in source
    assert "SetRuntimeReady" in source
    assert "EDoorXRProvider::Meta" in source


def test_plugin_has_no_hard_meta_sdk_dependency():
    build = BUILD.read_text()
    assert '"HTTP"' in build
    assert '"Json"' in build
    assert "OculusXR" not in build
    assert "MetaXR" not in build


def test_handoff_keeps_existing_gameplay_gate_authoritative():
    readme = README.read_text()
    assert "TryEnterRetroDoor" in readme
    assert "only path allowed to transition into a realm" in readme
