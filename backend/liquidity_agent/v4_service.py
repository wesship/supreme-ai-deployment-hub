from __future__ import annotations

import httpx

from .certification import SimulationCertificateError, load_certified_safe_draft
from .models import LiquidityAction, LiquidityRequest, LiquidityResponse
from .policy import evaluate_request
from .uniswap_v4 import V4VerificationError, normalize_pool_id, verify_uniswap_v4_pool
from .v4_simulation import build_v4_fork_harness_plan, validate_v4_pool_key


def _execution_lock() -> dict[str, bool]:
    return {
        "private_key_access": False,
        "signing": False,
        "broadcast": False,
        "fund_movement": False,
        "production_execution": False,
    }


def _candidate_pool_id(request: LiquidityRequest) -> str | None:
    if not request.pool or not request.pool.pool_id:
        return None
    try:
        return normalize_pool_id(request.pool.pool_id)
    except V4VerificationError:
        return None


def _static_pool_key_mismatches(request: LiquidityRequest) -> list[str]:
    if not request.v4_pool_key or not request.pool:
        return []
    key = request.v4_pool_key
    pool = request.pool
    mismatches: list[str] = []
    if pool.fee_tier is not None and pool.fee_tier != key.fee:
        mismatches.append("candidate_fee_tier_mismatch")

    address_tokens = {
        item.lower()
        for item in pool.underlying_tokens
        if isinstance(item, str) and item.startswith("0x") and len(item) == 42
    }
    key_tokens = {key.currency0_address.lower(), key.currency1_address.lower()}
    if len(address_tokens) >= 2 and not key_tokens.issubset(address_tokens):
        mismatches.append("candidate_underlying_token_mismatch")
    return mismatches


def _metadata_int(request: LiquidityRequest, key: str, default: int) -> int:
    value = request.metadata.get(key, default)
    if isinstance(value, bool):
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


async def run_v4_liquidity_agent(request: LiquidityRequest) -> LiquidityResponse:
    """Canonical Base V4 verification, trusted certification, and proposal-only planning."""
    violations = evaluate_request(request)
    if violations:
        return LiquidityResponse(
            action=request.action,
            status="policy_blocked",
            message="V4 liquidity request was blocked by the D3VONN policy firewall.",
            data={"violations": violations, "execution": _execution_lock()},
        )

    if request.chain.lower() != "base" or request.protocol.lower() != "uniswap-v4":
        return LiquidityResponse(
            action=request.action,
            status="policy_blocked",
            message="The V4 verifier is restricted to Base Uniswap V4.",
            data={"execution": _execution_lock()},
        )

    pool_id = _candidate_pool_id(request)
    if not pool_id:
        return LiquidityResponse(
            action=request.action,
            status="v4_pool_id_required",
            message="A concrete 32-byte Uniswap V4 PoolId is required for StateView verification.",
            data={"execution": _execution_lock()},
        )

    try:
        state = await verify_uniswap_v4_pool(pool_id)
    except (V4VerificationError, httpx.HTTPError, ValueError, TypeError) as exc:
        return LiquidityResponse(
            action=request.action,
            status="verification_failed",
            message="The PoolId could not be verified through canonical Base Uniswap V4 StateView.",
            data={
                "pool_id": pool_id,
                "reason": str(exc) if isinstance(exc, V4VerificationError) else type(exc).__name__,
                "execution": _execution_lock(),
            },
        )

    base_data = {
        "verified_state": state.model_dump(),
        "execution": _execution_lock(),
        "pool_id_hash_boundary": {
            "server_recomputes_pool_id": False,
            "foundry_recomputes_with_official_pool_id_library": True,
            "reason": "avoid_custom_python_keccak_implementation",
        },
    }

    if request.action in {LiquidityAction.verify_pool_state, LiquidityAction.analyze_pool}:
        return LiquidityResponse(
            action=request.action,
            status="canonical_v4_state_verified",
            message="Canonical Base Uniswap V4 state verified through StateView with read-only RPC calls.",
            data=base_data,
        )

    if request.action == LiquidityAction.analyze_pool_history:
        return LiquidityResponse(
            action=request.action,
            status="v4_history_not_enabled",
            message="The V4 chain-state verifier does not claim a historical indexer source for this PoolId.",
            data=base_data,
        )

    if request.action in {
        LiquidityAction.build_simulation_plan,
        LiquidityAction.simulate_deposit,
        LiquidityAction.simulate_rebalance,
    }:
        if request.v4_pool_key is None:
            return LiquidityResponse(
                action=request.action,
                status="v4_pool_key_required",
                message="A complete V4 PoolKey is required before a fork mutation harness can be planned.",
                data=base_data,
            )
        try:
            validate_v4_pool_key(request.v4_pool_key)
        except ValueError as exc:
            return LiquidityResponse(
                action=request.action,
                status="v4_pool_key_invalid",
                message="The supplied V4 PoolKey failed deterministic validation.",
                data={**base_data, "reason": str(exc)},
            )

        mismatches = _static_pool_key_mismatches(request)
        if mismatches:
            return LiquidityResponse(
                action=request.action,
                status="candidate_mismatch",
                message="Provider metadata conflicts with the supplied V4 PoolKey.",
                data={**base_data, "violations": mismatches},
            )

        try:
            plan = build_v4_fork_harness_plan(
                state,
                request.v4_pool_key,
                half_width_bps=request.range_half_width_bps,
            )
        except ValueError as exc:
            return LiquidityResponse(
                action=request.action,
                status="simulation_plan_blocked",
                message="The fork-only V4 simulation plan was blocked by a deterministic safety rule.",
                data={**base_data, "reason": str(exc)},
            )

        checkpoint_payload = {
            "title": "D3VONN V4 fork simulation planned",
            "type": "liquidity_v4_fork_simulation",
            "content": "Canonical V4 state verified; fork harness plan emitted with production execution disabled.",
            "metadata": {
                "pool_id": state.pool_id,
                "fork_block_number": state.block_number,
                "harness_path": plan.harness_path,
                "production_execution_enabled": False,
            },
            "persisted": False,
        }
        return LiquidityResponse(
            action=request.action,
            status="v4_fork_harness_ready",
            message="A fork-only PositionManager harness plan is ready; no production transaction can be signed or broadcast.",
            data={
                **base_data,
                "simulation_plan": plan.model_dump(),
                "hermes_checkpoint_payload": checkpoint_payload,
            },
        )

    if request.action == LiquidityAction.propose_safe_transaction:
        goal_id = request.metadata.get("certificate_goal_id")
        execution_id = request.metadata.get("certificate_execution_id")
        sequence = _metadata_int(request, "certificate_sequence", 1)
        max_block_age = _metadata_int(request, "max_certificate_block_age", 900)
        if not isinstance(goal_id, str) or not goal_id or not isinstance(execution_id, str) or not execution_id:
            return LiquidityResponse(
                action=request.action,
                status="certificate_reference_required",
                message="A persisted Hermes simulation-certificate reference is required before a Safe draft can be prepared.",
                data={**base_data, "execution": _execution_lock()},
            )

        try:
            safe_draft = await load_certified_safe_draft(
                goal_id=goal_id,
                execution_id=execution_id,
                sequence=sequence,
                expected_pool_id=state.pool_id,
                current_block_number=state.block_number,
                expected_pool_key=request.v4_pool_key,
                max_block_age=max_block_age,
            )
        except (SimulationCertificateError, ValueError, TypeError) as exc:
            return LiquidityResponse(
                action=request.action,
                status="proposal_blocked_by_certificate",
                message="The persisted V4 simulation certificate did not satisfy the Safe-draft policy.",
                data={
                    **base_data,
                    "reason": str(exc) if isinstance(exc, SimulationCertificateError) else type(exc).__name__,
                    "execution": _execution_lock(),
                },
            )

        return LiquidityResponse(
            action=request.action,
            status="safe_proposal_draft_ready",
            message=(
                "A Safe proposal draft was reconstructed from a persisted passing simulation certificate. "
                "Submission, signing, broadcasting, and autonomous fund movement remain disabled."
            ),
            data={
                **base_data,
                "safe_proposal_draft": safe_draft,
                "certificate_reference": {
                    "goal_id": goal_id,
                    "execution_id": execution_id,
                    "sequence": sequence,
                },
                "execution": _execution_lock(),
            },
        )

    return LiquidityResponse(
        action=request.action,
        status="canonical_v4_state_verified",
        message="Canonical V4 state verified under the simulation-only safety boundary.",
        data=base_data,
    )
