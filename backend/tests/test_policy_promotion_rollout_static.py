from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ROUTER = ROOT / "backend" / "ai_films" / "policy_promotion_rollout_router.py"
MAIN = ROOT / "backend" / "main.py"
MIGRATION = ROOT / "supabase" / "migrations" / "20260912233500_ai_film_policy_promotion_rollouts.sql"


def test_rollout_requires_independent_approved_review_and_stays_non_executing():
    text = ROUTER.read_text()
    assert 'decision": "eq.approved"' in text
    assert "Second review is not independent" in text
    assert '"runtime_changed": False' in text
    assert '"production_applied": False' in text
    assert '"rollback_ready": True' in text


def test_rollout_is_bounded_and_production_is_fail_closed():
    text = ROUTER.read_text()
    assert "adjustment < -5 or adjustment > 5" in text
    assert "Explicit production rollout authorization is required" in text
    assert "sha256" in text
    assert "effective_runtime_changed" in text


def test_rollout_ledger_is_read_only_to_authenticated_clients():
    sql = MIGRATION.read_text().lower()
    assert "enable row level security" in sql
    assert "revoke all on table public.ai_film_policy_promotion_rollouts from anon, authenticated" in sql
    assert "grant select on table public.ai_film_policy_promotion_rollouts to authenticated" in sql
    assert "grant select, insert, update, delete on table public.ai_film_policy_promotion_rollouts to service_role" in sql
    assert "environment <> 'production' or authorization_token_hash is not null" in sql


def test_rollout_router_is_registered_under_api():
    text = MAIN.read_text()
    assert '("backend.ai_films.policy_promotion_rollout_router", "router", "/api")' in text
