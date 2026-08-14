from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ANALYTICS = (ROOT / "backend/moneyhub/analytics_router.py").read_text()


def test_executive_pnl_is_owner_scoped_and_currency_separated():
    lowered = ANALYTICS.lower()
    assert '@router.get("/executive/agent-pnl")' in lowered
    assert '"owner_id": f"eq.{principal.user_id}"' in lowered
    assert "currency_totals" in lowered
    assert '"currency_mixing_disabled": true' in lowered


def test_executive_pnl_includes_recent_runtime_costs():
    lowered = ANALYTICS.lower()
    assert "moneyhub_runtime_cost_ingestions" in lowered
    assert "recent_runtime_costs" in lowered
    assert "tokens_used" in lowered
    assert "duration_ms" in lowered


def test_executive_pnl_reports_margin_per_currency_and_agent():
    lowered = ANALYTICS.lower()
    assert "profit_margin_pct" in lowered
    assert "net_profit" in lowered
    assert "revenue" in lowered
    assert "costs" in lowered
