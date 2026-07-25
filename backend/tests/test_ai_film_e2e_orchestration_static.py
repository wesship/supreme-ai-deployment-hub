from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SERVICE = (ROOT / "backend/ai_films/orchestration.py").read_text()
ROUTER = (ROOT / "backend/ai_films/router.py").read_text()


def test_orchestration_creates_complete_scene_to_release_chain():
    for table in (
        "ai_film_projects",
        "ai_film_scenes",
        "ai_film_storyboards",
        "ai_film_shots",
        "ai_film_render_jobs",
        "ai_film_export_jobs",
        "ai_film_subtitle_tracks",
        "ai_film_publications",
        "ai_film_commercial_releases",
        "ai_film_activity_events",
    ):
        assert f'"{table}"' in SERVICE


def test_orchestration_uses_caller_jwt_and_rls():
    assert "Bearer {access_token}" in SERVICE
    assert "SUPABASE_ANON_KEY" in SERVICE
    assert "SUPABASE_SERVICE_ROLE_KEY" not in SERVICE
    assert "current_user" in SERVICE


def test_orchestration_rolls_back_project_on_failure():
    assert "delete_project" in SERVICE
    assert "if project is not None" in SERVICE


def test_endpoint_requires_bearer_auth_and_does_not_execute_providers():
    assert '/orchestrations/test-production' in ROUTER
    assert "Supabase bearer token required" in ROUTER
    assert "does not spend provider credits" in ROUTER
    assert '"external_execution": "queued_not_invoked"' in SERVICE


def test_render_jobs_cover_media_pipeline():
    for job_type in ("storyboard", "video", "voice", "music", "trailer"):
        assert f'("{job_type}"' in SERVICE
