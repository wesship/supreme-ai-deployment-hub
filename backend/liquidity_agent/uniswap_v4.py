from __future__ import annotations

import re
from typing import Any

import httpx

from .models import V4PoolStateSnapshot
from .rpc import BASE_CHAIN_ID, RPC_TIMEOUT_SECONDS, _rpc_url

# Official Base deployment addresses from Uniswap/contracts deployments/json/8453.json.
BASE_UNISWAP_V4_POOL_MANAGER = "0x498581ff718922c3f8e6a244956af099b2652b2b"
BASE_UNISWAP_V4_POSITION_MANAGER = "0x7c5f5a4bbd8fd63184577525326123b519429bdc"
BASE_UNISWAP_V4_STATE_VIEW = "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71"
BASE_UNISWAP_PERMIT2 = "0x000000000022d473030f116ddee9f6b43ac78ba3"

# Fixed selectors for view-only V4 reads.
SELECTOR_POOL_MANAGER = "0xdc4c90d3"  # poolManager()
SELECTOR_GET_SLOT0 = "0xc815641c"  # getSlot0(bytes32)
SELECTOR_GET_LIQUIDITY = "0xfa6793d5"  # getLiquidity(bytes32)

_BYTES32_RE = re.compile(r"^0x[a-fA-F0-9]{64}$")
_EMPTY_CODE = {"0x", "0x0", "0x00"}


class V4VerificationError(ValueError):
    pass


def normalize_pool_id(value: str) -> str:
    if not isinstance(value, str) or not _BYTES32_RE.fullmatch(value):
        raise V4VerificationError("invalid_v4_pool_id")
    return value.lower()


def _strip_0x(value: str) -> str:
    if not isinstance(value, str) or not value.startswith("0x"):
        raise V4VerificationError("invalid_hex_response")
    return value[2:]


def _words(value: str, minimum: int = 1) -> list[bytes]:
    raw = _strip_0x(value)
    if len(raw) < 64 * minimum or len(raw) % 64 != 0:
        raise V4VerificationError("invalid_abi_response")
    data = bytes.fromhex(raw)
    return [data[i : i + 32] for i in range(0, len(data), 32)]


def _decode_address(value: str) -> str:
    return "0x" + _words(value)[0][-20:].hex()


def _decode_uint_word(word: bytes) -> int:
    return int.from_bytes(word, "big", signed=False)


def _decode_int_word(word: bytes) -> int:
    return int.from_bytes(word, "big", signed=True)


def _pool_id_calldata(selector: str, pool_id: str) -> str:
    return selector + normalize_pool_id(pool_id)[2:]


async def _post_rpc(payload: Any) -> Any:
    url = _rpc_url()
    if not url:
        raise V4VerificationError("base_rpc_not_configured")
    async with httpx.AsyncClient(timeout=RPC_TIMEOUT_SECONDS, follow_redirects=False) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        return response.json()


async def verify_uniswap_v4_pool(pool_id: str) -> V4PoolStateSnapshot:
    """Verify Base Uniswap V4 state using canonical StateView and read-only RPC.

    This verifier intentionally accepts a PoolId rather than implementing PoolKey
    keccak hashing in Python. If a PoolKey is supplied for a mutation simulation,
    the official Solidity PoolIdLibrary recomputes and asserts the PoolId inside
    the Foundry harness before any fork-only mutation.
    """
    canonical_pool_id = normalize_pool_id(pool_id)
    slot0_data = _pool_id_calldata(SELECTOR_GET_SLOT0, canonical_pool_id)
    liquidity_data = _pool_id_calldata(SELECTOR_GET_LIQUIDITY, canonical_pool_id)

    specs = [
        (1, "chain_id", "eth_chainId", []),
        (2, "block_number", "eth_blockNumber", []),
        (3, "state_view_code", "eth_getCode", [BASE_UNISWAP_V4_STATE_VIEW, "latest"]),
        (4, "pool_manager_code", "eth_getCode", [BASE_UNISWAP_V4_POOL_MANAGER, "latest"]),
        (5, "position_manager_code", "eth_getCode", [BASE_UNISWAP_V4_POSITION_MANAGER, "latest"]),
        (
            6,
            "state_view_manager",
            "eth_call",
            [{"to": BASE_UNISWAP_V4_STATE_VIEW, "data": SELECTOR_POOL_MANAGER}, "latest"],
        ),
        (
            7,
            "position_manager_manager",
            "eth_call",
            [{"to": BASE_UNISWAP_V4_POSITION_MANAGER, "data": SELECTOR_POOL_MANAGER}, "latest"],
        ),
        (
            8,
            "slot0",
            "eth_call",
            [{"to": BASE_UNISWAP_V4_STATE_VIEW, "data": slot0_data}, "latest"],
        ),
        (
            9,
            "liquidity",
            "eth_call",
            [{"to": BASE_UNISWAP_V4_STATE_VIEW, "data": liquidity_data}, "latest"],
        ),
    ]
    payload = [
        {"jsonrpc": "2.0", "id": item_id, "method": method, "params": params}
        for item_id, _, method, params in specs
    ]
    body = await _post_rpc(payload)
    if not isinstance(body, list):
        raise V4VerificationError("invalid_rpc_batch_response")
    by_id = {item.get("id"): item for item in body if isinstance(item, dict)}

    results: dict[str, str] = {}
    for item_id, label, _, _ in specs:
        item = by_id.get(item_id, {})
        if item.get("error"):
            raise V4VerificationError(f"rpc_read_failed:{label}")
        result = item.get("result")
        if not isinstance(result, str):
            raise V4VerificationError(f"missing_rpc_result:{label}")
        results[label] = result

    chain_id = int(results["chain_id"], 16)
    block_number = int(results["block_number"], 16)
    if chain_id != BASE_CHAIN_ID:
        raise V4VerificationError("wrong_chain")

    for label in ("state_view_code", "pool_manager_code", "position_manager_code"):
        if results[label].lower() in _EMPTY_CODE:
            raise V4VerificationError(f"canonical_contract_missing:{label}")

    if _decode_address(results["state_view_manager"]) != BASE_UNISWAP_V4_POOL_MANAGER:
        raise V4VerificationError("state_view_pool_manager_mismatch")
    if _decode_address(results["position_manager_manager"]) != BASE_UNISWAP_V4_POOL_MANAGER:
        raise V4VerificationError("position_manager_pool_manager_mismatch")

    slot0_words = _words(results["slot0"], minimum=4)
    sqrt_price_x96 = _decode_uint_word(slot0_words[0])
    tick = _decode_int_word(slot0_words[1])
    protocol_fee = _decode_uint_word(slot0_words[2])
    lp_fee = _decode_uint_word(slot0_words[3])
    liquidity = _decode_uint_word(_words(results["liquidity"])[0])

    # In StateView an uninitialized/nonexistent pool has zero sqrt price. Require a
    # real initialized pool before allowing a fork simulation plan to be emitted.
    if sqrt_price_x96 <= 0:
        raise V4VerificationError("v4_pool_not_initialized")

    return V4PoolStateSnapshot(
        verified=True,
        verification_checks=[
            "base_chain_id_verified",
            "canonical_state_view_code_present",
            "canonical_pool_manager_code_present",
            "canonical_position_manager_code_present",
            "state_view_points_to_canonical_pool_manager",
            "position_manager_points_to_canonical_pool_manager",
            "state_view_slot0_loaded",
            "state_view_liquidity_loaded",
        ],
        block_number=block_number,
        pool_id=canonical_pool_id,
        canonical_pool_manager=BASE_UNISWAP_V4_POOL_MANAGER,
        canonical_position_manager=BASE_UNISWAP_V4_POSITION_MANAGER,
        canonical_state_view=BASE_UNISWAP_V4_STATE_VIEW,
        sqrt_price_x96=sqrt_price_x96,
        tick=tick,
        protocol_fee=protocol_fee,
        lp_fee=lp_fee,
        liquidity=liquidity,
        pool_key_hash_verified_on_server=False,
    )
