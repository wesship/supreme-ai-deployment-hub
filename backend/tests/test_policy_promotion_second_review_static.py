from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ROUTER = ROOT / "backend/ai_films/policy_promotion_review_router.py"
MIGRATION = ROOT / "supabase/migrations/20260913001500_ai_film_policy_promotion_second_review.sql"
MAIN = ROOT / "backend/main.py"


def test_second_review_endpoint_is_registered_and_non_executing():
    router = ROUTER.read_text()
    main = MAIN.read_text()
    assert 'router = APIRouter(prefix="/ai-films/policy-promotions"' in router
    assert '@router.post("/{change_request_id}/reviews"' in router
    assert '"promotion_executed": False' in router
    assert '"routing_changed": False' in router
    assert 'backend.ai_films.policy_promotion_review_router' in main


def test_original_requestor_cannot_second_review():
    router = ROUTER.read_text()
    assert 'change_request.get("requestor_id")' in router
    assert 'Original requestor cannot perform the second review' in router


def test_approval_derives_canary_state_from_persisted_request():
    router = ROUTER.read_text()
    assert 'required_canary_state' in router
    assert 'Required provider canary has not passed' in router
    assert 'if decision == "rejected"' in router
    assert 'return "not_checked"' in router


def test_review_ledger_is_backend_insert_only_and_append_only():
    migration = MIGRATION.read_text()
    assert 'grant select on table public.ai_film_policy_promotion_reviews to authenticated' in migration
    assert 'grant select, insert' not in migration
    assert 'unique(change_request_id)' in migration
    assert 'owners and reviewers read policy promotion reviews' in migration
    assert 'for update' not in migration.lower()
    assert 'for delete' not in migration.lower()
