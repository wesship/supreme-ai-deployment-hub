#!/usr/bin/env python3
"""Certify the public Messari health contract without reading credentials."""

import json
import time
import urllib.error
import urllib.request


HEALTH_URL = "https://api.d3vonn.io/api/market-intelligence/health"


def certify() -> None:
    request = urllib.request.Request(
        HEALTH_URL,
        headers={"Accept": "application/json", "User-Agent": "D3VONN-Messari-Certification/1.0"},
        method="GET",
    )
    for attempt in range(1, 4):
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                if response.status != 200:
                    raise ValueError(f"health returned HTTP {response.status}")
                data = json.load(response)
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
            print("Certified live Messari configuration: enabled, configured, read-only, execution disabled.")
            return
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            if attempt == 3:
                raise SystemExit(f"MESSARI_PRODUCTION_CERTIFICATION_FAILED: {exc}") from exc
            time.sleep(5)


if __name__ == "__main__":
    certify()
