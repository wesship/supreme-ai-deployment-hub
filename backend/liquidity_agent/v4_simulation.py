from __future__ import annotations

import math
import re

from .models import RangePlan, V4ForkHarnessPlan, V4PoolKey, V4PoolStateSnapshot

MIN_TICK = -887272
MAX_TICK = 887272
ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
_ADDRESS_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")


def _address(value: str) -> str:
    if not isinstance(value, str) or not _ADDRESS_RE.fullmatch(value):
        raise ValueError("invalid_v4_pool_key_address")
    return value.lower()


def validate_v4_pool_key(pool_key: V4PoolKey) -> None:
    currency0 = _address(pool_key.currency0_address)
    currency1 = _address(pool_key.currency1_address)
    _address(pool_key.hooks_address)
    if currency0 == currency1:
        raise ValueError("v4_pool_key_duplicate_currency")
    # V4 PoolKey currencies must be sorted by address, with native currency (0)
    # naturally sorting before ERC-20 addresses.
    if int(currency0, 16) >= int(currency1, 16):
        raise ValueError("v4_pool_key_currency_order_invalid")
    if pool_key.tick_spacing <= 0:
        raise ValueError("invalid_tick_spacing")


def _snap_down(tick: int, spacing: int) -> int:
    return math.floor(tick / spacing) * spacing


def _snap_up(tick: int, spacing: int) -> int:
    return math.ceil(tick / spacing) * spacing


def build_v4_range_plan(
    state: V4PoolStateSnapshot,
    pool_key: V4PoolKey,
    *,
    half_width_bps: int,
) -> RangePlan:
    validate_v4_pool_key(pool_key)
    bounded_bps = max(50, min(half_width_bps, 5000))
    price_ratio = 1 + bounded_bps / 10_000
    tick_distance = max(
        pool_key.tick_spacing,
        math.ceil(math.log(price_ratio) / math.log(1.0001)),
    )
    lower = _snap_down(state.tick - tick_distance, pool_key.tick_spacing)
    upper = _snap_up(state.tick + tick_distance, pool_key.tick_spacing)
    min_usable = _snap_up(MIN_TICK, pool_key.tick_spacing)
    max_usable = _snap_down(MAX_TICK, pool_key.tick_spacing)
    lower = max(min_usable, lower)
    upper = min(max_usable, upper)
    if lower >= upper:
        raise ValueError("range_collapsed")
    return RangePlan(
        current_tick=state.tick,
        lower_tick=lower,
        upper_tick=upper,
        tick_spacing=pool_key.tick_spacing,
        requested_half_width_bps=bounded_bps,
        approximate_price_width_pct=bounded_bps / 100,
        current_tick_in_range=lower <= state.tick < upper,
    )


def build_v4_fork_harness_plan(
    state: V4PoolStateSnapshot,
    pool_key: V4PoolKey,
    *,
    half_width_bps: int = 500,
) -> V4ForkHarnessPlan:
    """Describe a fork-only V4 mutation test. This never emits a production tx."""
    validate_v4_pool_key(pool_key)
    if _address(pool_key.currency0_address) == ZERO_ADDRESS:
        raise ValueError("v4_native_currency_mutation_not_enabled_v0_4")

    range_plan = build_v4_range_plan(state, pool_key, half_width_bps=half_width_bps)
    return V4ForkHarnessPlan(
        fork_block_number=state.block_number,
        pool_id=state.pool_id,
        canonical_pool_manager=state.canonical_pool_manager,
        canonical_position_manager=state.canonical_position_manager,
        canonical_state_view=state.canonical_state_view,
        pool_key=pool_key,
        range_plan=range_plan,
        scenarios=[
            "verify_pool_id_from_official_pool_key_library",
            "mint_position_on_pinned_fork",
            "increase_liquidity_on_pinned_fork",
            "decrease_liquidity_on_pinned_fork",
            "collect_fees_on_pinned_fork",
            "complete_exit_on_pinned_fork",
        ],
        invariants=[
            "pool_key_to_id_equals_expected_pool_id",
            "state_view_and_position_manager_share_canonical_pool_manager",
            "test_actor_funded_only_with_forge_cheatcodes",
            "position_liquidity_changes_match_requested_scenario",
            "token_balance_deltas_are_accounted_for",
            "tick_range_contains_verified_current_tick",
            "slippage_bounds_are_explicit",
            "gas_usage_is_reported",
            "unexpected_reverts_fail_the_simulation",
            "no_production_rpc_mutation",
            "no_private_key_or_broadcast_path",
        ],
        forge_command=[
            "forge",
            "test",
            "--root",
            "tools/liquidity_v4",
            "--match-contract",
            "D3VONNLiquidityV4ForkTest",
            "-vvv",
        ],
        report_schema={
            "version": "d3vonn-liquidity-v4-simulation-v0.4",
            "required_fields": [
                "pool_id",
                "fork_block_number",
                "scenario",
                "passed",
                "gas_used",
                "token0_delta",
                "token1_delta",
                "liquidity_before",
                "liquidity_after",
                "revert_reason",
            ],
            "hermes_checkpoint_type": "liquidity_v4_fork_simulation",
        },
        private_key_access=False,
        signing_enabled=False,
        broadcast_enabled=False,
        production_execution_enabled=False,
    )
