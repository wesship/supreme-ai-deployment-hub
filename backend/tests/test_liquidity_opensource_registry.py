from backend.opensource_integrations.adapters import route_capability
from backend.opensource_integrations.models import CapabilityRequest
from backend.opensource_integrations.registry import get_provider


def test_liquidity_stack_is_registered():
    for key in (
        "defillama_yields",
        "uniswap_ai",
        "foundry",
        "safe_core",
        "hummingbot_gateway",
        "graph_node",
        "uniswap_v4",
    ):
        assert get_provider(key) is not None


def test_planned_liquidity_provider_cannot_become_live_by_empty_env():
    response = route_capability(
        CapabilityRequest(
            capability="transaction_simulation",
            task="simulate a Uniswap liquidity rebalance",
        )
    )
    assert response.provider == "foundry"
    assert response.status == "planned"
    assert response.status != "ready_for_live_client"


def test_safe_proposal_provider_is_planned_only():
    response = route_capability(
        CapabilityRequest(
            capability="safe_transaction_proposal",
            task="prepare proposal only",
        )
    )
    assert response.provider == "safe_core"
    assert response.status == "planned"
