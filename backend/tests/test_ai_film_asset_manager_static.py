from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SERVICE = ROOT / "src/features/ai-films/assetManagerService.ts"
WORKSPACE = ROOT / "src/pages/AIFilmStudio.tsx"
APP = ROOT / "src/App.tsx"


def test_asset_manager_service_requires_authentication_and_owner_scope():
    source = SERVICE.read_text()
    assert "supabase.auth.getUser" in source
    assert "Sign in is required" in source
    assert "owner_id: user.id" in source
    assert ".eq('owner_id', user.id)" in source


def test_completed_dump_import_is_idempotent():
    source = SERVICE.read_text()
    assert "source_filename" in source
    assert "existingFiles" in source
    assert "pending.length === 0" in source
    assert "aiFilmImageTaxonomy" in source


def test_asset_workspace_has_local_seed_and_remote_sync():
    source = WORKSPACE.read_text()
    assert "seedAssets" in source
    assert "ensureSovereignSignalProject" in source
    assert "fetchProjectAssets" in source
    assert "importCompletedImageDump" in source
    assert "Import Completed Dump" in source
    assert "Production Asset Library" in source


def test_asset_workspace_supports_search_and_taxonomy_filters():
    source = WORKSPACE.read_text()
    assert "asset-search" in source
    assert "aiFilmImageCategories" in source
    assert "matchesCategory" in source
    assert "asset.tags.join" in source


def test_asset_workspace_route_is_authenticated():
    source = APP.read_text()
    assert 'const AIFilmStudio = lazy(() => import("./pages/AIFilmStudio"))' in source
    assert 'path="/ai-films/studio"' in source
    assert "<AuthenticatedRoute><AIFilmStudio /></AuthenticatedRoute>" in source
