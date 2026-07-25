from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase/migrations/20260725070000_ai_film_enterprise.sql"
SERVICE = ROOT / "src/features/ai-films/enterpriseStudioService.ts"
WORKSPACE = ROOT / "src/features/ai-films/EnterpriseStudioWorkspace.tsx"
STUDIO = ROOT / "src/pages/AIFilmStudio.tsx"


def test_enterprise_schema_has_collaboration_analytics_and_commercial_tables():
    source = MIGRATION.read_text(encoding="utf-8")
    for table in ["ai_film_collaborators", "ai_film_activity_events", "ai_film_analytics_snapshots", "ai_film_commercial_releases"]:
        assert f"create table if not exists public.{table}" in source
        assert f"alter table public.{table} enable row level security" in source
    assert source.count("owner_id = auth.uid()") >= 4


def test_enterprise_service_requires_auth_and_owner_scope():
    source = SERVICE.read_text(encoding="utf-8")
    assert "supabase.auth.getUser" in source
    assert "Sign in is required" in source
    assert ".eq('owner_id', user.id)" in source
    assert "owner_id: user.id" in source


def test_enterprise_service_supports_collaboration_analytics_and_releases():
    source = SERVICE.read_text(encoding="utf-8")
    assert "inviteCollaborator" in source
    assert "recordActivity" in source
    assert "createAnalyticsSnapshot" in source
    assert "createCommercialRelease" in source
    assert "can_approve" in source


def test_enterprise_workspace_exposes_operational_controls():
    source = WORKSPACE.read_text(encoding="utf-8")
    for label in ["Save Analytics Snapshot", "Collaboration", "Commercial Release", "Create Commercial Plan"]:
        assert label in source
    assert "aria-live=\"polite\"" in source


def test_studio_integrates_enterprise_workspace():
    source = STUDIO.read_text(encoding="utf-8")
    assert "EnterpriseStudioWorkspace" in source
    assert "<EnterpriseStudioWorkspace project={project} assets={assets} />" in source
    assert "Release 7 · Enterprise Film OS" in source
