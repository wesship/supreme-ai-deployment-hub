from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase/migrations/20260912225000_routing_recommendation_approval_ledger.sql"
HASH_MIGRATION = ROOT / "supabase/migrations/20260912225500_routing_recommendation_approval_hash.sql"
IDENTITY_MIGRATION = ROOT / "supabase/migrations/20260912230000_routing_recommendation_approval_identity_defaults.sql"
SERVICE = ROOT / "src/features/ai-films/routingRecommendationApprovalService.ts"
WORKSPACE = ROOT / "src/features/ai-films/RoutingRecommendationWorkspace.tsx"


def test_approval_ledger_is_owner_scoped_append_only_for_authenticated_clients():
    text = MIGRATION.read_text()
    assert "enable row level security" in text
    assert "grant select, insert on table public.ai_film_routing_recommendation_approvals to authenticated" in text
    assert "grant select, insert, update, delete on table public.ai_film_routing_recommendation_approvals to service_role" in text
    assert "owners read routing recommendation approvals" in text
    assert "owners create routing recommendation approvals" in text
    assert "(select auth.uid()) = owner_id" in text
    assert "(select auth.uid()) = reviewer_id" in text
    assert "unique (owner_id, recommendation_key, evidence_hash)" in text


def test_approval_evidence_is_hashed_server_side_and_identity_is_session_derived():
    hash_text = HASH_MIGRATION.read_text()
    identity_text = IDENTITY_MIGRATION.read_text()
    assert "security invoker" in hash_text
    assert "extensions.digest" in hash_text
    assert "before insert" in hash_text
    assert "owner_id set default auth.uid()" in identity_text
    assert "reviewer_id set default auth.uid()" in identity_text


def test_client_records_decision_without_submitting_identity_or_runtime_changes():
    service = SERVICE.read_text()
    assert "recordRoutingRecommendationDecision" in service
    assert "routingRecommendationEvidence" in service
    assert ".from('ai_film_routing_recommendation_approvals')" in service
    assert ".insert({" in service
    assert "owner_id:" not in service
    assert "reviewer_id:" not in service
    assert "AI_FILM_EXECUTABLE_VIDEO_PROVIDERS" not in service
    assert "AI_FILM_PROVIDER_CANARY" not in service


def test_workspace_requires_rationale_and_separates_approval_from_apply():
    text = WORKSPACE.read_text()
    assert "Approve evidence" in text
    assert "Reject evidence" in text
    assert "Human decision rationale" in text
    assert "approvalMatchesRecommendation" in text
    assert "Evidence hash" in text
    assert "Approval is a governance record, not an execution command" in text
    assert "There is still no Apply action" in text
