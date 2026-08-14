from backend.moneyhub.router import AccountCreate, JournalCreate, RiskEvaluationRequest, router


def test_moneyhub_routes_are_mounted_without_client_owner_id():
    paths = {route.path for route in router.routes}
    assert "/moneyhub/accounts" in paths
    assert "/moneyhub/balances" in paths
    assert "/moneyhub/journals" in paths
    assert "/moneyhub/journals/{journal_id}/reverse" in paths
    assert "/moneyhub/risk/evaluate" in paths
    assert "/moneyhub/health" in paths

    assert "owner_id" not in AccountCreate.model_fields
    assert "owner_id" not in JournalCreate.model_fields
    assert "owner_id" not in RiskEvaluationRequest.model_fields


def test_moneyhub_live_execution_route_is_absent():
    paths = {route.path for route in router.routes}
    assert all("execute" not in path for path in paths)
    assert all("broker" not in path for path in paths)
    assert all("trade" not in path for path in paths)
