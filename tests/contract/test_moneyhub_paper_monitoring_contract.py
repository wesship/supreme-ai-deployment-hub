from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MONITORING_SQL = (ROOT / "supabase/migrations/20260811223500_moneyhub_paper_daily_loss_hardening.sql").read_text()
ENGINE_SQL = (ROOT / "supabase/migrations/20260811220500_moneyhub_paper_execution_engine.sql").read_text()
ENGINE_ROUTER = (ROOT / "backend/moneyhub/engine_router.py").read_text()
MONITOR_ROUTER = (ROOT / "backend/moneyhub/monitor_router.py").read_text()


def test_daily_loss_uses_daily_nav_not_lifetime_realized_pnl():
    assert "v_daily_start_nav - v_nav" in MONITORING_SQL
    assert "v_daily_loss >= v_limit.daily_loss_limit" in MONITORING_SQL
    assert "greatest(-v_realized,0) >= v_limit.daily_loss_limit" not in MONITORING_SQL


def test_simulation_rpc_is_service_role_only_and_long_only():
    assert "grant execute on function public.moneyhub_paper_execute_order" in ENGINE_SQL
    assert "to service_role" in ENGINE_SQL
    assert "from public, anon, authenticated" in ENGINE_SQL
    assert "paper engine is long-only" in ENGINE_SQL
    assert "insufficient paper cash" in ENGINE_SQL


def test_engine_calls_risk_policy_before_simulated_execution():
    risk_pos = ENGINE_ROUTER.index("evaluate_risk")
    rpc_pos = ENGINE_ROUTER.index("moneyhub_paper_execute_order")
    assert risk_pos < rpc_pos
    assert '"mode": "simulation_only"' in ENGINE_ROUTER


def test_monitoring_exposes_only_simulation_marking_and_snapshot_routes():
    assert '/mark-to-market' in MONITOR_ROUTER
    assert '/snapshot' in MONITOR_ROUTER
    forbidden = ("broker", "withdraw", "live-order", "live_trade", "custody")
    lowered = MONITOR_ROUTER.lower()
    for term in forbidden:
        assert term not in lowered
