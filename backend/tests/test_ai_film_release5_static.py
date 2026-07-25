from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase/migrations/20260725052000_ai_film_storyboards.sql"
SERVICE = ROOT / "src/features/ai-films/storyboardService.ts"
WORKSPACE = ROOT / "src/features/ai-films/StoryboardWorkspace.tsx"
STUDIO = ROOT / "src/pages/AIFilmStudio.tsx"


def test_storyboard_schema_and_rls():
    source = MIGRATION.read_text(encoding="utf-8")
    assert "create table if not exists public.ai_film_storyboards" in source
    assert "create table if not exists public.ai_film_shots" in source
    assert "alter table public.ai_film_storyboards enable row level security" in source
    assert "alter table public.ai_film_shots enable row level security" in source
    assert source.count("owner_id = auth.uid()") >= 2


def test_storyboard_service_requires_auth_and_generates_five_shots():
    source = SERVICE.read_text(encoding="utf-8")
    assert "supabase.auth.getUser" in source
    assert "Sign in is required" in source
    assert "planStoryboardShots" in source
    assert source.count("shotNumber:") == 5
    assert "Director AI Planner" not in source
    assert "d3vonn-director-planner-v1" in source


def test_storyboard_service_persists_boards_and_shots():
    source = SERVICE.read_text(encoding="utf-8")
    assert "ai_film_storyboards" in source
    assert "ai_film_shots" in source
    assert "onConflict: 'scene_id'" in source
    assert "onConflict: 'storyboard_id,shot_number'" in source
    assert ".eq('owner_id', user.id)" in source


def test_storyboard_workspace_exposes_shot_planning():
    source = WORKSPACE.read_text(encoding="utf-8")
    for label in ["Generate Shot Plan", "Storyboard + Shot Planner", "Visual direction", "Image prompt"]:
        assert label in source
    assert "aria-live=\"polite\"" in source


def test_studio_integrates_storyboard_workspace():
    source = STUDIO.read_text(encoding="utf-8")
    assert "StoryboardWorkspace" in source
    assert "<StoryboardWorkspace project={project} />" in source
    assert "Release 5 · AI Pre-Production" in source
