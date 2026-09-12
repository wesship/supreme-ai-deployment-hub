#!/usr/bin/env python3
"""Certify the public Messari read-only health and collection contracts."""

import json
import time
import urllib.error
import urllib.request


BASE_URL = "https://api.d3vonn.io/api/market-intelligence"
QUERY = {
    "query": "Bitcoin",
    "asset_class": "crypto",
    "symbols": ["BTC"],
    "providers": ["messari"],
    "save_to_dkos": False,
    "max_results_per_source": 1,
}


def fetch_json(path: str, *, payload: dict | None = None) -> dict:
    headers = {"Accept": "application/json", "User-Agent": "D3VONN-Messari-Certification/1.0"}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(
        BASE_URL + path,
        headers=headers,
        data=json.dumps(payload).encode() if payload is not None else None,
        method="POST" if payload is not None else "GET",
    )
    with urllib.request.urlopen(request, timeout=25) as response:
        if response.status != 200:
            raise ValueError(f"{path} returned HTTP {response.status}")
        data = json.load(response)
    if not isinstance(data, dict):
        raise ValueError(f"{path} returned a non-object response")
    return data


def verify_health(data: dict) -> None:
    providers = data.get("providers")
    if not isinstance(providers, list):
        raise ValueError("providers is not a list")
    messari = next((item for item in providers if isinstance(item, dict) and item.get("provider") == "messari"), None)
    if not isinstance(messari, dict):
        raise ValueError("Messari provider is absent")

    required = {
        "status": data.get("status") == "ok",
        "mode": data.get("mode") == "read_only",
        "execution_enabled": data.get("execution_enabled") is False,
        "signing_enabled": data.get("signing_enabled") is False,
        "broadcast_enabled": data.get("broadcast_enabled") is False,
        "messari.enabled": messari.get("enabled") is True,
        "messari.configured": messari.get("configured") is True,
        "messari.mode": messari.get("mode") == "read_only",
        "messari.execution_enabled": messari.get("execution_enabled") is False,
    }
    failed = [name for name, valid in required.items() if not valid]
    if failed:
        raise ValueError("health contract failed: " + ", ".join(failed))


def verify_query(data: dict) -> None:
    signals = data.get("signals")
    providers = data.get("providers")
    routing = data.get("routing")
    query = data.get("query")
    required = {
        "query.status": data.get("status") == "ready",
        "query.provider_errors": data.get("provider_errors") == {},
        "query.messari_provider": isinstance(providers, list) and any(
            isinstance(item, dict) and item.get("provider") == "messari" and item.get("enabled") is True
            for item in providers
        ),
        "query.messari_signal": isinstance(signals, list) and any(
            isinstance(item, dict) and item.get("provider") == "messari" and item.get("symbol") == "BTC"
            for item in signals
        ),
        "query.persistence_disabled": isinstance(query, dict) and query.get("save_to_dkos") is False,
        "query.dkos_status": data.get("dkos_status") == "skipped" and data.get("dkos_records") == 0,
        "query.execution_disabled": isinstance(routing, dict) and routing.get("execution_allowed") is False,
        "query.signing_disabled": isinstance(routing, dict) and routing.get("signing_allowed") is False,
        "query.broadcast_disabled": isinstance(routing, dict) and routing.get("broadcast_allowed") is False,
    }
    failed = [name for name, valid in required.items() if not valid]
    if failed:
        raise ValueError("read-only Messari query failed: " + ", ".join(failed))


def certify() -> None:
    for attempt in range(1, 4):
        try:
            verify_health(fetch_json("/health"))
            verify_query(fetch_json("/query", payload=QUERY))
            print("Certified live Messari collection: BTC signal returned; persistence and execution disabled.")
            return
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            if attempt == 3:
                raise SystemExit(f"MESSARI_PRODUCTION_CERTIFICATION_FAILED: {exc}") from exc
            time.sleep(5)


if __name__ == "__main__":
    certify()
