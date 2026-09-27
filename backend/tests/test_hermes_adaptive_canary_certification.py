from pathlib import Path

MIGRATION = Path("supabase/migrations/20260926235500_hermes_adaptive_canary_certification.sql").read_text()


def test_certification_requires_completed_linked_canary():
    assert "v_task.status <> 'COMPLETED'" in MIGRATION
    assert "task_type" in MIGRATION
    assert "adaptive_canary" in MIGRATION
    assert "adaptive.canary" in MIGRATION


def test_certification_uses_frozen_baseline_and_persisted_candidate_metrics():
    assert "v_request.evidence->'baseline_metrics'" in MIGRATION
    assert "output_data #> '{dispatch_result,output,certification_metrics}'" in MIGRATION


def test_certification_requires_measured_cost_evidence():
    assert "cost_measured" in MIGRATION
    assert "completed canary lacks measured cost evidence" in MIGRATION


def test_certification_pass_is_the_only_path_to_promotion_candidate():
    assert "if v_decision='pass' then" in MIGRATION
    assert "hermes_adaptive_promotion_candidates" in MIGRATION
    assert "production_retained" in MIGRATION
