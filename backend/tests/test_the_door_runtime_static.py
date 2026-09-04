from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ROUTER = ROOT / "backend" / "the_door" / "router.py"
REGISTRY = ROOT / "backend" / "app" / "routers" / "__init__.py"
AURA = ROOT / "backend" / "the_door" / "aura_adapter.py"
OPEN_SOURCE = ROOT / "backend" / "the_door" / "open_source_adapters.py"
BLENDER = ROOT / "backend" / "the_door" / "blender_pipeline.py"
CONTRACTS = ROOT / "backend" / "the_door" / "contracts.py"


def test_the_door_router_is_registered():
    source = REGISTRY.read_text()
    assert "from backend.the_door.router import router as the_door_router" in source
    assert 'proxy_router.include_router(the_door_router, tags=["the-door"])' in source


def test_the_door_exposes_health_and_capabilities():
    source = ROUTER.read_text()
    assert '@router.get("/health")' in source
    assert '@router.get("/capabilities")' in source
    assert '@router.get("/assets/capabilities")' in source
    assert '@router.post("/assets/prepare"' in source
    assert '"purpose": "game-development"' in source
    assert '"control_plane": "multi-engine"' in source
    assert '["build", "playtest", "observe", "diagnose", "repair", "verify"]' in source


def test_runtime_mutations_require_auth():
    source = ROUTER.read_text()
    assert "Depends(get_current_user_id)" in source


def test_aura_is_adapter_not_hard_dependency():
    source = AURA.read_text()
    assert 'return "aura"' in source
    assert 'return False' in source
    assert '"mode": "adapter-boundary"' in source
    assert "Aura editor transport is not configured yet." in source


def test_open_source_engine_boundaries_exist_and_fail_closed():
    source = OPEN_SOURCE.read_text()
    for provider in ("GODOT", "O3DE", "BEVY", "STRIDE", "GDEVELOP"):
        assert f"EngineProvider.{provider}" in source
    assert '"mode": "adapter-boundary"' in source
    assert "transport is not configured yet." in source
    assert "DoorJobState.BLOCKED" in source


def test_blender_is_asset_pipeline_not_engine():
    source = BLENDER.read_text()
    contracts = CONTRACTS.read_text()
    assert "class BlenderAssetPipeline" in source
    assert '"mode": "asset-pipeline-boundary"' in source
    assert '"shared_consumers": ["ai-films", "the-door"]' in source
    assert 'BLENDER = "blender"' in contracts
    assert "class AssetPipelineProvider" in contracts


def test_contract_has_multi_engine_runtimes():
    source = CONTRACTS.read_text()
    for engine in ("UNREAL", "GODOT", "O3DE", "BEVY", "STRIDE", "GDEVELOP"):
        assert f"    {engine} =" in source


def test_contract_has_full_closed_loop_job_kinds():
    source = CONTRACTS.read_text()
    for kind in (
        "AUTHOR_GAMEPLAY_LOGIC",
        "RUN_PLAYTEST",
        "CAPTURE_OBSERVATION",
        "DIAGNOSE_FAILURE",
        "APPLY_REPAIR",
        "VERIFY_RESULT",
        "PACKAGE_BUILD",
    ):
        assert kind in source
