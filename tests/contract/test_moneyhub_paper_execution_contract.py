from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ENGINE = (ROOT / "backend/moneyhub/engine_router.py").read_text()
MONITOR = (ROOT / "backend/moneyhub/monitor_router.py").read_text()
MIGRATION = (ROOT / "supabase/migrations/20260811220500_moneyhub_paper_execution_engine.sql").read_text()
MONITORING = (ROOT / "supabase/migrations/20260811222000_moneyhub_paper_monitoring.sql").read_text()
HARDENING = (ROOT / "supabase/migrations/20260811223500_moneyhub_paper_daily_loss_hardening.sql").read_text()


def test_execution_is_explicitly_simulation_only():
    text = (ENGINE + MONITOR + MIGRATION + MONITORING + HARDENING).lower()
    assert "simulation_only" in text
    assert "broker" not in ENGINE.lower()
    assert "withdraw" not in ENGINE.lower()


def test_browser_cannot_call_execution_rpcs_directly():
    assert "revoke all on function public.moneyhub_paper_execute_order" in MIGRATION.lower()
    assert "from public, anon, authenticated" in MIGRATION.lower()
    assert "grant execute on function public.moneyhub_paper_execute_order" in MIGRATION.lower()
    assert "to service_role" in MIGRATION.lower()
    assert "revoke all on function public.moneyhub_paper_mark_to_market" in MONITORING.lower()
    assert "revoke all on function public.moneyhub_paper_snapshot" in HARDENING.lower()


def test_execution_enforces_cash_and_long_only_positions():
    lowered = MIGRATION.lower()
    assert "insufficient paper cash" in lowered
    assert "paper engine is long-only" in lowered
    assert "quantity >= 0" in lowered


def test_orders_are_risk_checked_before_execution():
    lowered = ENGINE.lower()
    assert "evaluate_risk" in lowered
    assert "if not risk.allowed" in lowered
    assert "risk_reject" in lowered
    assert "moneyhub_paper_execute_order" in lowered
    assert lowered.index("evaluate_risk") < lowered.index("moneyhub_paper_execute_order")


def test_position_limits_include_existing_exposure():
    lowered = ENGINE.lower()
    assert "_current_position" in lowered
    assert "current_position_value" in lowered
    assert "projected_position_value" in lowered
    assert "current_value + simulated_gross" in lowered
    assert "projected_position_value=projected_position_value" in lowered


def test_immediate_executor_is_market_only():
    assert 'order_type: literal["market"]' in ENGINE.lower()
    assert '"execution_mode": "simulation_only"' in ENGINE


def test_monitoring_has_drawdown_daily_loss_and_kill_circuits():
    lowered = HARDENING.lower()
    assert "kill_switch" in lowered
    assert "drawdown_pause" in lowered
    assert "daily_loss_pause" in lowered
    assert "v_daily_start_nav - v_nav" in lowered
    assert "v_daily_loss >= v_limit.daily_loss_limit" in lowered
    assert "status='paused'" in lowered
    assert "moneyhub_paper_performance" in lowered
