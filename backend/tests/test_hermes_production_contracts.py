from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
COMPAT = (ROOT / "supabase/migrations/20260929032609_hermes_adaptive_governance_production_compat.sql").read_text()
ENQUEUE = (ROOT / "supabase/functions/enqueue-task/index.ts").read_text()


def test_adaptive_compat_does_not_require_task_user_id():
    assert "where id=v_request.canary_task_id and user_id=p_user_id" not in COMPAT
    assert "insert into public.hermes_tasks(\n    user_id," not in COMPAT


def test_adaptive_compat_functions_are_service_role_only():
    assert "set search_path = ''" in COMPAT
    assert "to service_role;" in COMPAT
    assert "from public, anon, authenticated;" in COMPAT or "from public,anon,authenticated;" in COMPAT


def test_enqueue_task_matches_current_hermes_contract():
    assert 'status: "PENDING"' in ENQUEUE
    assert 'task_type: "external_webhook"' in ENQUEUE
    assert 'source: "enqueue-task"' in ENQUEUE
    assert "body.task_payload ?? body.payload ?? {}" in ENQUEUE
