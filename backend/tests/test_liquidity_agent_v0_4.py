import asyncio

from backend.liquidity_agent import uniswap_v4
from backend.liquidity_agent.models import (
    LiquidityAction,
    LiquidityRequest,
    PoolCandidate,
    V4PoolKey,
    V4PoolStateSnapshot,
)
from backend.liquidity_agent.uniswap_v4 import (
    BASE_UNISWAP_V4_POOL_MANAGER,
    BASE_UNISWAP_V4_POSITION_MANAGER,
    BASE_UNISWAP_V4_STATE_VIEW,
    SELECTOR_GET_LIQUIDITY,
    SELECTOR_GET_SLOT0,
    SELECTOR_POOL_MANAGER,
    normalize_pool_id,
    verify_uniswap_v4_pool,
)
from backend.liquidity_agent.v4_service import run_v4_liquidity_agent
from backend.liquidity_agent.v4_simulation import build_v4_fork_harness_plan

POOL_ID = "0x" + "ab" * 32
TOKEN0 = "0x1111111111111111111111111111111111111111"
TOKEN1 = "0x2222222222222222222222222222222222222222"


def _word_uint(value: int) -> str:
    return value.to_bytes(32, "big", signed=False).hex()


def _word_int(value: int) -> str:
    return value.to_bytes(32, "big", signed=True).hex()


def _word_address(value: str) -> str:
    return value[2:].lower().rjust(64, "0")


def test_v4_selectors_and_official_base_addresses_are_pinned():
    assert SELECTOR_GET_SLOT0 == "0xc815641c"
    assert SELECTOR_GET_LIQUIDITY == "0xfa6793d5"
    assert SELECTOR_POOL_MANAGER == "0xdc4c90d3"
    assert BASE_UNISWAP_V4_POOL_MANAGER == "0x498581ff718922c3f8e6a244956af099b2652b2b"
    assert BASE_UNISWAP_V4_POSITION_MANAGER == "0x7c5f5a4bbd8fd63184577525326123b519429bdc"
    assert BASE_UNISWAP_V4_STATE_VIEW == "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71"


def test_v4_pool_id_requires_bytes32():
    assert normalize_pool_id(POOL_ID) == POOL_ID
    try:
        normalize_pool_id("0x1234")
    except ValueError as exc:
        assert str(exc) == "invalid_v4_pool_id"
    else:
        raise AssertionError("short pool id must fail")


def test_v4_stateview_verification_uses_read_only_rpc(monkeypatch):
    slot0 = "0x" + _word_uint(2**96) + _word_int(-120) + _word_uint(0) + _word_uint(3000)
    liquidity = "0x" + _word_uint(123456)
    manager_word = "0x" + _word_address(BASE_UNISWAP_V4_POOL_MANAGER)

    async def fake_post(payload):
        methods = [item["method"] for item in payload]
        assert set(methods).issubset({"eth_chainId", "eth_blockNumber", "eth_getCode", "eth_call"})
        assert "eth_sendTransaction" not in methods
        assert "eth_sendRawTransaction" not in methods
        results = {
            1: "0x2105",
            2: "0x123456",
            3: "0x6001",
            4: "0x6001",
            5: "0x6001",
            6: manager_word,
            7: manager_word,
            8: slot0,
            9: liquidity,
        }
        return [{"jsonrpc": "2.0", "id": item_id, "result": value} for item_id, value in results.items()]

    monkeypatch.setattr(uniswap_v4, "_post_rpc", fake_post)
    state = asyncio.run(verify_uniswap_v4_pool(POOL_ID))
    assert state.verified is True
    assert state.tick == -120
    assert state.lp_fee == 3000
    assert state.liquidity == 123456
    assert state.pool_key_hash_verified_on_server is False


def _state() -> V4PoolStateSnapshot:
    return V4PoolStateSnapshot(
        verified=True,
        verification_checks=["test"],
        block_number=123,
        pool_id=POOL_ID,
        canonical_pool_manager=BASE_UNISWAP_V4_POOL_MANAGER,
        canonical_position_manager=BASE_UNISWAP_V4_POSITION_MANAGER,
        canonical_state_view=BASE_UNISWAP_V4_STATE_VIEW,
        sqrt_price_x96=2**96,
        tick=0,
        protocol_fee=0,
        lp_fee=3000,
        liquidity=1_000_000,
    )


def _key() -> V4PoolKey:
    return V4PoolKey(
        currency0_address=TOKEN0,
        currency1_address=TOKEN1,
        fee=3000,
        tick_spacing=60,
    )


def test_v4_fork_plan_never_enables_production_execution():
    plan = build_v4_fork_harness_plan(_state(), _key(), half_width_bps=500)
    assert plan.pool_id_recomputed_in_foundry is True
    assert plan.test_only_funded_account is True
    assert plan.private_key_access is False
    assert plan.signing_enabled is False
    assert plan.broadcast_enabled is False
    assert plan.production_execution_enabled is False
    assert "pool_key_to_id_equals_expected_pool_id" in plan.invariants
    assert "mint_position_on_pinned_fork" in plan.scenarios
    assert plan.range_plan.current_tick_in_range is True


def test_v4_service_requires_pool_key_before_mutation_plan(monkeypatch):
    async def fake_verify(pool_id):
        assert pool_id == POOL_ID
        return _state()

    monkeypatch.setattr("backend.liquidity_agent.v4_service.verify_uniswap_v4_pool", fake_verify)
    request = LiquidityRequest(
        action=LiquidityAction.build_simulation_plan,
        chain="base",
        protocol="uniswap-v4",
        pool=PoolCandidate(chain="base", protocol="uniswap-v4", pool_id=POOL_ID),
    )
    response = asyncio.run(run_v4_liquidity_agent(request))
    assert response.status == "v4_pool_key_required"
    assert response.live_execution_enabled is False
    assert response.private_key_access is False
    assert response.broadcast_enabled is False


def test_v4_service_emits_unpersisted_hermes_checkpoint_payload(monkeypatch):
    async def fake_verify(pool_id):
        return _state()

    monkeypatch.setattr("backend.liquidity_agent.v4_service.verify_uniswap_v4_pool", fake_verify)
    request = LiquidityRequest(
        action=LiquidityAction.build_simulation_plan,
        chain="base",
        protocol="uniswap-v4",
        pool=PoolCandidate(
            chain="base",
            protocol="uniswap-v4",
            pool_id=POOL_ID,
            fee_tier=3000,
            underlying_tokens=[TOKEN0, TOKEN1],
        ),
        v4_pool_key=_key(),
    )
    response = asyncio.run(run_v4_liquidity_agent(request))
    assert response.status == "v4_fork_harness_ready"
    assert response.data["simulation_plan"]["production_execution_enabled"] is False
    checkpoint = response.data["hermes_checkpoint_payload"]
    assert checkpoint["persisted"] is False
    assert checkpoint["type"] == "liquidity_v4_fork_simulation"
