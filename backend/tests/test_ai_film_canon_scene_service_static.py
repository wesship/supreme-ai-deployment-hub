from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SERVICE = ROOT / "src/features/ai-films/canonSceneService.ts"
SEEDS = ROOT / "src/features/ai-films/canonSeeds.ts"


def test_canon_service_requires_authentication_and_owner_scope():
    source = SERVICE.read_text(encoding="utf-8")
    assert "supabase.auth.getUser" in source
    assert "Sign in is required" in source
    assert ".eq('owner_id', user.id)" in source
    assert "owner_id: user.id" in source


def test_canon_rules_are_upserted_by_stable_key():
    source = SERVICE.read_text(encoding="utf-8")
    assert "ai_film_canon_rules" in source
    assert "onConflict: 'project_id,rule_key'" in source
    assert "requiredTerms" in source
    assert "forbiddenTerms" in source


def test_scene_workflow_supports_creation_linking_and_validation():
    source = SERVICE.read_text(encoding="utf-8")
    assert "createScene" in source
    assert "ai_film_scene_assets" in source
    assert "onConflict: 'scene_id,asset_id,usage_type'" in source
    assert "validateSceneAgainstCanon" in source
    assert "persistCanonValidation" in source


def test_production_readiness_is_calculated_from_scene_state():
    source = SERVICE.read_text(encoding="utf-8")
    assert "calculateProductionReadiness" in source
    assert "passingScenes" in source
    assert "packagedScenes" in source
    assert "validatedScenes" in source


def test_sovereign_signal_locked_rules_are_seeded():
    source = SEEDS.read_text(encoding="utf-8")
    required_rules = {
        "legend-white-shirt",
        "door-is-alignment",
        "residual-balance-side-effect",
        "genesis-mode-sonic-law",
        "signal-vfx-restraint",
    }
    for rule in required_rules:
        assert rule in source
    assert source.count("ruleKey:") == 5
    assert "plain white T-shirt only" in source
    assert "Residual Balance is not a power" in source
