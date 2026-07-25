from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase/migrations/20260725061000_ai_film_delivery.sql"
SERVICE = ROOT / "src/features/ai-films/deliveryService.ts"
WORKSPACE = ROOT / "src/features/ai-films/DeliveryWorkspace.tsx"
STUDIO = ROOT / "src/pages/AIFilmStudio.tsx"


def test_delivery_schema_has_attempts_exports_subtitles_and_publications():
    source = MIGRATION.read_text(encoding="utf-8")
    for table in ["ai_film_render_attempts", "ai_film_export_jobs", "ai_film_subtitle_tracks", "ai_film_publications"]:
        assert f"create table if not exists public.{table}" in source
        assert f"alter table public.{table} enable row level security" in source
    assert source.count("owner_id = auth.uid()") >= 4


def test_delivery_service_requires_authentication_and_owner_scope():
    source = SERVICE.read_text(encoding="utf-8")
    assert "supabase.auth.getUser" in source
    assert "Sign in is required" in source
    assert ".eq('owner_id', user.id)" in source
    assert "owner_id: user.id" in source


def test_delivery_service_supports_exports_subtitles_publications_and_attempts():
    source = SERVICE.read_text(encoding="utf-8")
    assert "createExportJob" in source
    assert "createSubtitleTrack" in source
    assert "queuePublication" in source
    assert "registerRenderAttempt" in source
    assert "approval_required: true" in source


def test_delivery_workspace_is_operational_and_gated():
    source = WORKSPACE.read_text(encoding="utf-8")
    for label in ["Create Export Package", "Add English Subtitles", "Send to Internal Review", "Prepare D3VONN Release", "Prepare Archive"]:
        assert label in source
    assert "aria-live=\"polite\"" in source


def test_studio_integrates_delivery_workspace():
    source = STUDIO.read_text(encoding="utf-8")
    assert "DeliveryWorkspace" in source
    assert "<DeliveryWorkspace project={project} />" in source
    assert "Release 6 · Delivery Cloud" in source
