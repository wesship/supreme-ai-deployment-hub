from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ROUTER = ROOT / "backend" / "app" / "routers" / "moneyhub.py"


def test_cashflow_intelligence_endpoint_exists():
    source = ROUTER.read_text()
    assert '@router.get("/intelligence/cashflow")' in source
    assert '"inflow_7d"' in source
    assert '"outflow_7d"' in source
    assert '"net_7d"' in source
    assert '"inflow_30d"' in source
    assert '"outflow_30d"' in source
    assert '"net_30d"' in source
    assert '"avg_daily_net_30d"' in source


def test_cashflow_intelligence_exposes_source_and_daily_analysis():
    source = ROUTER.read_text()
    assert '"inflow_sources"' in source
    assert '"outflow_sources"' in source
    assert '"daily_series"' in source
    assert '"recurring_candidate"' in source
    assert '"negative_7d_cashflow"' in source
    assert '"negative_30d_cashflow"' in source
    assert '"outflow_concentration"' in source


def test_cashflow_intelligence_preserves_financial_safety_boundaries():
    source = ROUTER.read_text()
    assert '"bank_balance_available": False' in source
    assert '"runway_available": False' in source
    assert '"pending_transactions_included": False' in source
    assert '"fx_normalization_available": False' in source
    assert '"read_only": True' in source
    assert '"transfers": False' in source
    assert '"payments": False' in source
    assert '"lending_decisions": False' in source
    assert '"brokerage_execution": False' in source


def test_cashflow_intelligence_uses_verified_usd_events_only():
    source = ROUTER.read_text()
    assert '"status": "in.(verified,settled)"' in source
    assert '"currency": "eq.USD"' in source
    assert '"moneyhub_revenue_events"' in source
    assert '"moneyhub_cost_events"' in source
