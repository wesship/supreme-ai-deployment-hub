from __future__ import annotations

from decimal import Decimal, getcontext
import re
from typing import Any

import httpx

from .models import PoolStateSnapshot
from .rpc import BASE_CHAIN_ID, RPC_TIMEOUT_SECONDS, _rpc_url

BASE_UNISWAP_V3_FACTORY = "0x33128a8fc17869897dce68ed026d694621f6fdfd"

# Fixed selectors for read-only Uniswap V3 / ERC-20 view functions.
SELECTOR_FACTORY = "0xc45a0155"
SELECTOR_TOKEN0 = "0x0dfe1681"
SELECTOR_TOKEN1 = "0xd21220a7"
SELECTOR_FEE = "0xddca3f43"
SELECTOR_TICK_SPACING = "0xd0c93a7c"
SELECTOR_LIQUIDITY = "0x1a686502"
SELECTOR_SLOT0 = "0x3850c7bd"
SELECTOR_DECIMALS = "0x313ce567"
SELECTOR_GET_POOL = "0x1698ee82"

_ADDRESS_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")
_EMPTY_CODE = {"0x", "0x0", "0x00"}
getcontext().prec = 50


class PoolVerificationError(ValueError):
    pass


def _address(value: str) -> str:
    if not _ADDRESS_RE.fullmatch(value):
        raise PoolVerificationError("invalid_evm_address")
    return value.lower()


def _strip_0x(value: str) -> str:
    if not isinstance(value, str) or not value.startswith("0x"):
        raise PoolVerificationError("invalid_hex_response")
    return value[2:]


def _word_bytes(value: str) -> bytes:
    raw = _strip_0x(value)
    if len(raw) < 64 or len(raw) % 64 != 0:
        raise PoolVerificationError("invalid_abi_response")
    return bytes.fromhex(raw)


def _decode_uint(value: str) -> int:
    data = _word_bytes(value)
    return int.from_bytes(data[:32], "big", signed=False)


def _decode_int_word(word: bytes) -> int:
    return int.from_bytes(word, "big", signed=True)


def _decode_address(value: str) -> str:
    data = _word_bytes(value)
    return "0x" + data[:32][-20:].hex()


def _encode_address_word(value: str) -> str:
    return _address(value)[2:].rjust(64, "0")


def _encode_uint_word(value: int) -> str:
    if value < 0:
        raise PoolVerificationError("negative_uint")
    return hex(value)[2:].rjust(64, "0")


def _get_pool_calldata(token0: str, token1: str, fee: int) -> str:
    return (
        SELECTOR_GET_POOL
        + _encode_address_word(token0)
        + _encode_address_word(token1)
        + _encode_uint_word(fee)
    )


async def _post_rpc(payload: Any) -> Any:
    url = _rpc_url()
    if not url:
        raise PoolVerificationError("base_rpc_not_configured")
    async with httpx.AsyncClient(timeout=RPC_TIMEOUT_SECONDS, follow_redirects=False) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        return response.json()


async def _batch_read_pool(pool_address: str) -> tuple[int, int, dict[str, str]]:
    pool = _address(pool_address)
    specs = [
        (1, "chain_id", "eth_chainId", []),
        (2, "block_number", "eth_blockNumber", []),
        (3, "code", "eth_getCode", [pool, "latest"]),
        (4, "factory", "eth_call", [{"to": pool, "data": SELECTOR_FACTORY}, "latest"]),
        (5, "token0", "eth_call", [{"to": pool, "data": SELECTOR_TOKEN0}, "latest"]),
        (6, "token1", "eth_call", [{"to": pool, "data": SELECTOR_TOKEN1}, "latest"]),
        (7, "fee", "eth_call", [{"to": pool, "data": SELECTOR_FEE}, "latest"]),
        (8, "tick_spacing", "eth_call", [{"to": pool, "data": SELECTOR_TICK_SPACING}, "latest"]),
        (9, "liquidity", "eth_call", [{"to": pool, "data": SELECTOR_LIQUIDITY}, "latest"]),
        (10, "slot0", "eth_call", [{"to": pool, "data": SELECTOR_SLOT0}, "latest"]),
    ]
    payload = [
        {"jsonrpc": "2.0", "id": item_id, "method": method, "params": params}
        for item_id, _, method, params in specs
    ]
    body = await _post_rpc(payload)
    if not isinstance(body, list):
        raise PoolVerificationError("invalid_rpc_batch_response")
    by_id = {item.get("id"): item for item in body if isinstance(item, dict)}

    results: dict[str, str] = {}
    for item_id, label, _, _ in specs:
        item = by_id.get(item_id, {})
        if item.get("error"):
            raise PoolVerificationError(f"rpc_read_failed:{label}")
        result = item.get("result")
        if not isinstance(result, str):
            raise PoolVerificationError(f"missing_rpc_result:{label}")
        results[label] = result

    chain_id = int(results["chain_id"], 16)
    block_number = int(results["block_number"], 16)
    return chain_id, block_number, results


async def _read_token_decimals(token0: str, token1: str) -> tuple[int | None, int | None]:
    payload = [
        {
            "jsonrpc": "2.0",
            "id": 101,
            "method": "eth_call",
            "params": [{"to": _address(token0), "data": SELECTOR_DECIMALS}, "latest"],
        },
        {
            "jsonrpc": "2.0",
            "id": 102,
            "method": "eth_call",
            "params": [{"to": _address(token1), "data": SELECTOR_DECIMALS}, "latest"],
        },
    ]
    try:
        body = await _post_rpc(payload)
    except (httpx.HTTPError, ValueError):
        return None, None
    if not isinstance(body, list):
        return None, None
    by_id = {item.get("id"): item for item in body if isinstance(item, dict)}

    def parse(item_id: int) -> int | None:
        result = by_id.get(item_id, {}).get("result")
        if not isinstance(result, str):
            return None
        try:
            value = _decode_uint(result)
        except (ValueError, TypeError):
            return None
        return value if 0 <= value <= 36 else None

    return parse(101), parse(102)


async def _canonical_factory_pool(token0: str, token1: str, fee: int) -> str:
    calldata = _get_pool_calldata(token0, token1, fee)
    payload = {
        "jsonrpc": "2.0",
        "id": 201,
        "method": "eth_call",
        "params": [
            {"to": BASE_UNISWAP_V3_FACTORY, "data": calldata},
            "latest",
        ],
    }
    body = await _post_rpc(payload)
    if not isinstance(body, dict) or body.get("error"):
        raise PoolVerificationError("canonical_factory_lookup_failed")
    result = body.get("result")
    if not isinstance(result, str):
        raise PoolVerificationError("canonical_factory_lookup_missing")
    return _decode_address(result)


def _decode_slot0(value: str) -> tuple[int, int, bool]:
    data = _word_bytes(value)
    if len(data) < 32 * 7:
        raise PoolVerificationError("invalid_slot0_response")
    words = [data[i : i + 32] for i in range(0, 32 * 7, 32)]
    sqrt_price_x96 = int.from_bytes(words[0], "big", signed=False)
    tick = _decode_int_word(words[1])
    unlocked = bool(int.from_bytes(words[6], "big", signed=False))
    return sqrt_price_x96, tick, unlocked


def _display_price(
    sqrt_price_x96: int,
    token0_decimals: int | None,
    token1_decimals: int | None,
) -> str | None:
    if token0_decimals is None or token1_decimals is None or sqrt_price_x96 <= 0:
        return None
    ratio = (Decimal(sqrt_price_x96) / Decimal(2**96)) ** 2
    adjusted = ratio * (Decimal(10) ** Decimal(token0_decimals - token1_decimals))
    return format(adjusted, ".18g")


async def verify_uniswap_v3_pool(pool_address: str) -> PoolStateSnapshot:
    """Verify and read a Base Uniswap V3 pool using view-only JSON-RPC calls."""
    pool = _address(pool_address)
    chain_id, block_number, raw = await _batch_read_pool(pool)

    if chain_id != BASE_CHAIN_ID:
        raise PoolVerificationError("wrong_chain")
    if raw["code"].lower() in _EMPTY_CODE:
        raise PoolVerificationError("pool_has_no_contract_code")

    factory = _decode_address(raw["factory"])
    token0 = _decode_address(raw["token0"])
    token1 = _decode_address(raw["token1"])
    fee = _decode_uint(raw["fee"])

    spacing_data = _word_bytes(raw["tick_spacing"])
    tick_spacing = _decode_int_word(spacing_data[:32])
    liquidity = _decode_uint(raw["liquidity"])
    sqrt_price_x96, tick, unlocked = _decode_slot0(raw["slot0"])

    if factory != BASE_UNISWAP_V3_FACTORY:
        raise PoolVerificationError("pool_factory_mismatch")

    canonical_pool = await _canonical_factory_pool(token0, token1, fee)
    if canonical_pool != pool:
        raise PoolVerificationError("factory_get_pool_mismatch")

    token0_decimals, token1_decimals = await _read_token_decimals(token0, token1)
    checks = [
        "base_chain_id_verified",
        "contract_code_present",
        "pool_factory_matches_base_uniswap_v3",
        "factory_get_pool_matches_candidate",
        "slot0_read_only_state_loaded",
        "liquidity_read_only_state_loaded",
    ]

    return PoolStateSnapshot(
        chain="base",
        protocol="uniswap-v3",
        verified=True,
        verification_checks=checks,
        block_number=block_number,
        pool_address=pool,
        canonical_factory=BASE_UNISWAP_V3_FACTORY,
        token0_address=token0,
        token1_address=token1,
        token0_decimals=token0_decimals,
        token1_decimals=token1_decimals,
        fee_tier=fee,
        tick_spacing=tick_spacing,
        sqrt_price_x96=sqrt_price_x96,
        tick=tick,
        liquidity=liquidity,
        unlocked=unlocked,
        price_token1_per_token0=_display_price(
            sqrt_price_x96,
            token0_decimals,
            token1_decimals,
        ),
    )
