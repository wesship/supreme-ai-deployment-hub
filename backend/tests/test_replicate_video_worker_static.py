from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
WORKER = ROOT / "backend/ai_films/replicate_video_worker.py"
RESILIENT = ROOT / "backend/ai_films/resilient_video_worker.py"
CANARY = ROOT / "scripts/ai_films/production_replicate_video_canary.py"
WORKFLOW = ROOT / ".github/workflows/ai-films-replicate-video-canary.yml"


def test_replicate_worker_uses_activation_gate_and_private_result_fields():
    text = WORKER.read_text()
    assert 'activation_status("replicate", source).executable' in text
    assert 'provider": "replicate"' in text
    assert '"result_asset_id": asset_id or None' in text
    assert '"result_storage_path": object_path' in text
    assert '"cost_metadata": cost_metadata' in text
    assert '"qa": {"state": "pending_generated_qa"}' in text
    assert 'provider_media_url' not in text


def test_resilient_worker_claims_replicate_only_after_certification():
    text = RESILIENT.read_text()
    assert 'activation_status("replicate", source).executable' in text
    assert '_claim_replicate(db)' in text
    assert 'process_replicate_video_job(job, db, source)' in text


def test_replicate_canary_is_one_render_and_does_not_self_activate():
    script = CANARY.read_text()
    workflow = WORKFLOW.read_text()
    assert 'RUN_REPLICATE_VIDEO_CANARY' in script
    assert 'duration_target_seconds": 5' in script
    assert 'process_replicate_video_job(job, db, os.environ)' in script
    assert 'pending_generated_qa' in script
    assert 'workflow_dispatch' in workflow
    assert 'environment: production' in workflow
    assert "AI_FILM_AUTO_REGEN_ENABLED: 'false'" in workflow
    assert "AI_FILM_GENERATION_EXECUTION_ENABLED: 'false'" in workflow
    assert 'Do not activate routing automatically' in workflow
    assert 'schedule:' not in workflow
    assert 'push:' not in workflow
