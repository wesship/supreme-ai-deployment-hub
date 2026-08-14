from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ANALYTICS = (ROOT / "backend" / "moneyhub" / "analytics_router.py").read_text()
MIGRATION = (ROOT / "supabase" / "migrations" / "20260811211500_moneyhub_agent_pnl_paper_trading.sql").read_text()


def test_financial_owner_is_server_derived():
    assert "owner_id: " not in ANALYTICS
    assert '"owner_id": principal.user_id' in ANALYTICS
    assert "AuthenticatedAccess" in ANALYTICS


def test_agent_pnl_is_derived_from_attribution_events():
    assert "moneyhub_attribution_events" in MIGRATION
    assert "moneyhub_agent_pnl" in MIGRATION
    assert "net_profit" in MIGRATION
    assert "model_cost" in MIGRATION
    assert "infrastructure_cost" in MIGRATION


def test_paper_trading_remains_simulation_only():
    assert '"mode": "simulation_only"' in ANALYTICS
    assert '"broker_execution_enabled": False' in ANALYTICS
    assert '"withdrawals_enabled": False' in ANALYTICS
    forbidden = ["alpaca", "interactive_brokers", "coinbase_order", "binance_order", "/live/"]
    lowered = ANALYTICS.lower()
    for token in forbidden:
        assert token not in lowered


def test_promotion_path_stops_before_live_capital():
    assert '["backtest", "walk_forward", "paper", "shadow"]' in ANALYTICS
    assert "small_capital_live" not in ANALYTICS


def test_authenticated_clients_only_read_paper_tables_directly():
    for table in (
        "moneyhub_paper_strategies",
        "moneyhub_paper_runs",
        "moneyhub_paper_orders",
        "moneyhub_paper_fills",
    ):
        assert f"grant select on public.{table} to authenticated" in MIGRATION
        assert f"grant all on public.{table} to service_role" in MIGRATION
