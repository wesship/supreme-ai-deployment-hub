from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ROUTER = ROOT / "backend" / "app" / "routers" / "moneyhub.py"


def test_moneyhub_intelligence_summary_is_read_only_and_guarded():
    source = ROUTER.read_text()
    assert '@router.get("/intelligence/summary")' in source
    assert '"read_only": True' in source
    assert '"custody": False' in source
    assert '"brokerage_execution": False' in source
    assert '"transfers": False' in source
    assert '"lending_decisions": False' in source


def test_moneyhub_intelligence_queries_are_user_scoped():
    source = ROUTER.read_text()
    assert '"user_id": f"eq.{principal.user_id}"' in source
    assert '"moneyhub_revenue_events"' in source
    assert '"moneyhub_cost_events"' in source
    assert '"moneyhub_agent_runs"' in source
    assert '"money_agents"' in source


def test_moneyhub_intelligence_computes_operating_metrics():
    source = ROUTER.read_text()
    assert '"revenue_30d"' in source
    assert '"cost_30d"' in source
    assert '"net_30d"' in source
    assert '"margin_pct"' in source
    assert '"avg_revenue_per_run"' in source
    assert '"top_agent_share_pct"' in source
    assert '"revenue_concentration"' in source
    assert '"negative_operating_margin"' in source
    assert '"forecast_confidence"' in source
