from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORKSPACE = ROOT / "src/features/ai-films/StoragePackageWorkspace.tsx"
STUDIO = ROOT / "src/pages/AIFilmStudio.tsx"


def test_workspace_supports_uploads_and_signed_previews():
    source = WORKSPACE.read_text(encoding="utf-8")
    assert "uploadFilmAsset" in source
    assert "createAssetPreviewUrl" in source
    assert "film-media-upload" in source
    assert "Private Media Upload" in source
    assert "Preview" in source


def test_workspace_supports_production_packages():
    source = WORKSPACE.read_text(encoding="utf-8")
    assert "saveProductionPackage" in source
    assert "cameraPlan" in source
    assert "lightingPlan" in source
    assert "audioPlan" in source
    assert "vfxPlan" in source
    assert "editNotes" in source
    assert "Save Production Package" in source


def test_workspace_displays_release_readiness_details():
    source = WORKSPACE.read_text(encoding="utf-8")
    assert "getReleaseReadinessDetails" in source
    assert "Release readiness" in source
    assert "Uploaded media" in source
    assert "Passing scenes" in source
    assert "Packaged scenes" in source


def test_studio_integrates_storage_package_workspace():
    source = STUDIO.read_text(encoding="utf-8")
    assert "StoragePackageWorkspace" in source
    assert "onAssetUploaded={refreshAssets}" in source
    assert "Release 3 · Production Delivery" in source
