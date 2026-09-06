from __future__ import annotations

import os
from urllib.parse import urlparse

import httpx

BASE_CHAIN_ID = 8453
ALLOWED_RPC_METHODS = ("eth_chainId", "eth_blockNumber")
RPC_TIMEOUT_SECONDS = 8.0


def _rpc_url() -> str | None:
    value = (os.getenv("LIQUIDITY_BASE_RPC_URL") or os.getenv("BASE_RPC_URL") or "").strip()
    if not value:
        return None
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return value


async def base_rpc_snapshot() -> dict[str, object]:
    """Return a read-only Base chain freshness snapshot.

    Only eth_chainId and eth_blockNumber are sent. No transaction, signing,
    account-unlock, trace, or arbitrary user-selected RPC method is exposed.
    """
    url = _rpc_url()
    if not url:
        return {
            "configured": False,
            "status": "not_configured",
            "chain_id": BASE_CHAIN_ID,
            "allowed_methods": list(ALLOWED_RPC_METHODS),
        }

    payload = [
        {"jsonrpc": "2.0", "id": 1, "method": "eth_chainId", "params": []},
        {"jsonrpc": "2.0", "id": 2, "method": "eth_blockNumber", "params": []},
    ]
    try:
        async with httpx.AsyncClient(timeout=RPC_TIMEOUT_SECONDS, follow_redirects=False) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            body = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        return {
            "configured": True,
            "status": "unavailable",
            "chain_id": BASE_CHAIN_ID,
            "error_type": type(exc).__name__,
            "allowed_methods": list(ALLOWED_RPC_METHODS),
        }

    if not isinstance(body, list):
        return {
            "configured": True,
            "status": "invalid_response",
            "chain_id": BASE_CHAIN_ID,
            "allowed_methods": list(ALLOWED_RPC_METHODS),
        }

    by_id = {item.get("id"): item for item in body if isinstance(item, dict)}
    chain_hex = by_id.get(1, {}).get("result")
    block_hex = by_id.get(2, {}).get("result")
    try:
        chain_id = int(chain_hex, 16)
        block_number = int(block_hex, 16)
    except (TypeError, ValueError):
        return {
            "configured": True,
            "status": "invalid_response",
            "chain_id": BASE_CHAIN_ID,
            "allowed_methods": list(ALLOWED_RPC_METHODS),
        }

    return {
        "configured": True,
        "status": "ok" if chain_id == BASE_CHAIN_ID else "wrong_chain",
        "chain_id": chain_id,
        "block_number": block_number,
        "allowed_methods": list(ALLOWED_RPC_METHODS),
    }
