from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase/migrations/20260725043000_ai_film_release4_review_pipeline.sql"
SERVICE = ROOT / "src/features/ai-films/releaseControlService.ts"
WORKSPACE = ROOT / "src/features/ai-films/ReleaseControlWorkspace.tsx"
STUDIO = ROOT / "src/pages/AIFilmStudio.tsx"


def test_release4_schema_contains_review_and_render_tables():
    source = MIGRATION.read_text(encoding="utf-8")
    for table in [
        "ai_film_asset_versions",
        "ai_film_reviews",
        "ai_film_review_comments",
        "ai_film_release_checklists",
        "ai_film_render_jobs",
    ]:
        assert f"create table if not exists public.{table}" in source
        assert f"alter table public.{table} enable row level security" in source
    assert source.count('owner_id = auth.uid()') >= 5


def test_release_service_requires_authentication_and_owner_scope():
    source = SERVICE.read_text(encoding="utf-8")
    assert "supabase.auth.getUser" in source
    assert "Sign in is required" in source
    assert ".eq('owner_id', user.id)" in source
    assert "owner_id: user.id" in source


def test_release_service_supports_checklists_reviews_versions_and_render_jobs():
    source = SERVICE.read_text(encoding="utf-8")
    assert "seedReleaseChecklist" in source
    assert "upsertReview" in source
    assert "snapshotAssetVersion" in source
    assert "queueRenderJob" in source
    assert "calculateReleaseBlockers" in source
    assert "onConflict: 'project_id,target_type,target_id,review_type'" in source


def test_release_workspace_exposes_operational_controls():
    source = WORKSPACE.read_text(encoding="utf-8")
    for label in [
        "Initialize Release Checklist",
        "Release blockers",
        "Send to Review",
        "Approve Scene",
        "Request Changes",
        "Queue Storyboard",
    ]:
        assert label in source
    assert "changeAssetStatus('selected')" in source
    assert "aria-live=\"polite\"" in source


def test_studio_integrates_release_control():
    source = STUDIO.read_text(encoding="utf-8")
    assert "ReleaseControlWorkspace" in source
    assert "onAssetsChanged={refreshAssets}" in source
    assert "Release 4 · Review + Render Control" in source
