from __future__ import annotations

import math

from .models import ForkSimulationPlan, PoolStateSnapshot, RangePlan

MIN_TICK = -887272
MAX_TICK = 887272
DEFAULT_RPC_ENV_VAR = "LIQUIDITY_BASE_RPC_URL"


def _snap_down(tick: int, spacing: int) -> int:
    return math.floor(tick / spacing) * spacing


def _snap_up(tick: int, spacing: int) -> int:
    return math.ceil(tick / spacing) * spacing


def _usable_bounds(spacing: int) -> tuple[int, int]:
    return _snap_up(MIN_TICK, spacing), _snap_down(MAX_TICK, spacing)


def build_range_plan(
    state: PoolStateSnapshot,
    *,
    half_width_bps: int = 500,
) -> RangePlan:
    if state.tick_spacing <= 0:
        raise ValueError("invalid_tick_spacing")
    bounded_bps = max(50, min(half_width_bps, 5000))
    price_ratio = 1 + (bounded_bps / 10_000)
    tick_distance = max(
        state.tick_spacing,
        math.ceil(math.log(price_ratio) / math.log(1.0001)),
    )
    lower = _snap_down(state.tick - tick_distance, state.tick_spacing)
    upper = _snap_up(state.tick + tick_distance, state.tick_spacing)
    min_usable, max_usable = _usable_bounds(state.tick_spacing)
    lower = max(min_usable, lower)
    upper = min(max_usable, upper)

    if lower >= upper:
        raise ValueError("range_collapsed")

    return RangePlan(
        current_tick=state.tick,
        lower_tick=lower,
        upper_tick=upper,
        tick_spacing=state.tick_spacing,
        requested_half_width_bps=bounded_bps,
        approximate_price_width_pct=bounded_bps / 100,
        current_tick_in_range=lower <= state.tick < upper,
    )


def build_foundry_plan(
    state: PoolStateSnapshot,
    *,
    action: str,
    half_width_bps: int = 500,
) -> ForkSimulationPlan:
    """Build a reproducible fork plan without signing or broadcasting."""
    range_plan = build_range_plan(state, half_width_bps=half_width_bps)

    anvil_command = [
        "anvil",
        "--fork-url",
        f"${DEFAULT_RPC_ENV_VAR}",
        "--fork-block-number",
        str(state.block_number),
        "--chain-id",
        "8453",
    ]
    readback_commands = [
        [
            "cast",
            "call",
            state.pool_address,
            "slot0()(uint160,int24,uint16,uint16,uint16,uint8,bool)",
            "--rpc-url",
            "http://127.0.0.1:8545",
        ],
        [
            "cast",
            "call",
            state.pool_address,
            "liquidity()(uint128)",
            "--rpc-url",
            "http://127.0.0.1:8545",
        ],
    ]

    return ForkSimulationPlan(
        status="fork_plan_ready",
        action=action,
        chain_id=8453,
        fork_block_number=state.block_number,
        pool_address=state.pool_address,
        rpc_env_var=DEFAULT_RPC_ENV_VAR,
        range_plan=range_plan,
        anvil_command=anvil_command,
        readback_commands=readback_commands,
        simulation_steps=[
            "start_pinned_base_fork",
            "reverify_pool_state_on_fork",
            "snapshot_wallet_and_pool_balances",
            "calculate_position_amounts_for_range",
            "construct_position_manager_call_in_test_harness",
            "execute_only_inside_local_fork",
            "assert_slippage_gas_balance_and_revert_invariants",
            "emit_simulation_report_without_broadcast",
        ],
        requires_position_manager_harness=True,
        private_key_access=False,
        signing_enabled=False,
        broadcast_enabled=False,
        production_execution_enabled=False,
    )
