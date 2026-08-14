from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ROUTER = (ROOT / "backend/moneyhub/market_router.py").read_text()
MIGRATION = (ROOT / "supabase/migrations/20260811230000_moneyhub_market_data_promotion.sql").read_text()
STAGE_GUARD = (ROOT / "supabase/migrations/20260811230500_moneyhub_run_stage_guard.sql").read_text()
INIT = (ROOT / "backend/moneyhub/__init__.py").read_text()


def test_market_data_is_explicitly_simulation_only():
    lowered = (ROUTER + MIGRATION).lower()
    assert "manual_simulation" in lowered
    assert "simulation_only" in lowered
    assert "broker" not in ROUTER.lower()
    assert "withdraw" not in ROUTER.lower()


def test_quote_and_promotion_rpcs_are_backend_only():
    lowered = MIGRATION.lower()
    assert "revoke all on function public.moneyhub_ingest_market_quotes" in lowered
    assert "revoke all on function public.moneyhub_evaluate_strategy_promotion" in lowered
    assert "from public,anon,authenticated" in lowered
    assert "to service_role" in lowered


def test_promotion_path_cannot_skip_stages():
    lowered = MIGRATION.lower()
    assert "backtest' and to_stage='walk_forward" in lowered
    assert "walk_forward' and to_stage='paper" in lowered
    assert "paper' and to_stage='shadow" in lowered
    assert "strategy promotion stage" in lowered


def test_database_guards_run_stage_order():
    lowered = STAGE_GUARD.lower()
    assert "moneyhub_guard_paper_run_stage" in lowered
    assert "walk-forward run requires walk_forward promotion stage" in lowered
    assert "paper run requires paper promotion stage" in lowered
    assert "shadow run requires shadow promotion stage" in lowered


def test_promotion_requires_objective_metrics():
    lowered = MIGRATION.lower()
    for token in ["min_snapshots", "min_trades", "min_return_pct", "max_drawdown_pct", "min_score"]:
        assert token in lowered
    assert "run must be completed" in lowered
    assert "decision" in lowered
    assert "promoted" in lowered
    assert "held" in lowered


def test_market_router_is_registered():
    assert "from backend.moneyhub.market_router import router as market_router" in INIT
    assert "router.include_router(market_router)" in INIT


def test_manual_quote_ingestion_never_claims_verified_provider():
    lowered = ROUTER.lower()
    assert '"p_trust_tier": "manual_simulation"' in lowered
    assert '"verified_provider"' not in lowered


def test_quote_driven_mark_to_market_requires_fresh_quote_for_every_position():
    lowered = ROUTER.lower()
    assert "/runs/{run_id}/mark-from-market-data" in lowered
    assert "max_age_seconds" in lowered
    assert "fresh market data required for every open position" in lowered
    assert "moneyhub_paper_mark_to_market" in lowered
    assert "quotes_used" in lowered


def test_run_completion_rejects_unresolved_orders_and_circuit_pause():
    lowered = ROUTER.lower()
    assert "pending,accepted,partially_filled" in lowered
    assert "run has unresolved simulated orders" in lowered
    assert "moneyhub_paper_snapshot" in lowered
    assert 'snapshot.get("paused")' in lowered
    assert "circuit breaker paused the run; completion is blocked" in lowered
    assert '"status": "in.(pending,running)"' in lowered
