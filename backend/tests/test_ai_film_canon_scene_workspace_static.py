from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORKSPACE = ROOT / "src/features/ai-films/CanonSceneWorkspace.tsx"
STUDIO = ROOT / "src/pages/AIFilmStudio.tsx"


def test_canon_workspace_supports_rule_seeding_and_readiness():
    source = WORKSPACE.read_text(encoding="utf-8")
    assert "sovereignSignalCanonSeeds" in source
    assert "upsertCanonRule" in source
    assert "Seed Locked Canon" in source
    assert "calculateProductionReadiness" in source
    assert "Readiness" in source


def test_scene_workspace_supports_creation_validation_and_asset_linking():
    source = WORKSPACE.read_text(encoding="utf-8")
    assert "createScene" in source
    assert "validateSceneAgainstCanon" in source
    assert "persistCanonValidation" in source
    assert "linkAssetToScene" in source
    assert "Validate Scene" in source
    assert "Link Asset" in source


def test_studio_integrates_canon_scene_workspace():
    source = STUDIO.read_text(encoding="utf-8")
    assert "CanonSceneWorkspace" in source
    assert "<CanonSceneWorkspace project={project} assets={assets} />" in source
    assert "Release 2 · Canon + Scenes" in source
