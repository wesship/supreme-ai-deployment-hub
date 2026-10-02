"""Read-only Secret Energy acceptance workflow for the self-hosted Skyvern worker.

This script deliberately has no mutation operations. Authentication must already
exist in the Chrome profile used by the local Skyvern service.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from typing import Any

from skyvern import Skyvern


BASE_URL = os.getenv("SKYVERN_BASE_URL", "http://localhost:8000")
API_KEY = os.getenv("SKYVERN_API_KEY", "")
SECRET_ENERGY_URL = os.getenv("SECRET_ENERGY_URL", "https://secretenergy.com")

READ_ONLY_PROMPT = """
You are running a STRICT READ-ONLY acceptance check for the account already
signed in to Secret Energy in this browser profile.

Allowed:
- navigate within Secret Energy
- read visible member/account pages
- inspect Sanctuary and Awakening/progression information
- read the names/status of available and locked instruments
- read the title and a short summary of the latest personal reading if visible

Forbidden:
- typing into forms except navigation/search that cannot mutate account state
- sending messages or posting content
- creating, editing, deleting, or publishing journal entries
- purchases, subscriptions, billing, marketplace checkout, or payment actions
- changing profile, privacy, notification, membership, security, or settings
- clicking any control whose purpose is to save, submit, buy, publish, delete,
  confirm, sync, connect, upgrade, unlock-for-payment, or otherwise mutate state

If the browser is signed out, stop and report authenticated=false. Never attempt
or request credentials.

Return ONLY one JSON object with exactly these top-level keys:
{
  "authenticated": boolean,
  "awakening": {
    "day": integer|null,
    "total_days": integer|null,
    "streak_days": integer|null
  },
  "sanctuary_prompts": [string],
  "available_instruments": [string],
  "locked_instruments": [string],
  "latest_reading_title": string|null,
  "latest_reading_summary": string|null,
  "source": "secretenergy.com",
  "mode": "read_only"
}

Do not invent unavailable values. Use null or empty arrays instead.
""".strip()


def _extract_output(result: Any) -> str:
    output = getattr(result, "output", None)
    if output is None and isinstance(result, dict):
        output = result.get("output")
    if output is None:
        raise RuntimeError("Skyvern returned no output")
    if isinstance(output, str):
        return output.strip()
    return json.dumps(output)


def _validate_contract(payload: dict[str, Any]) -> dict[str, Any]:
    required = {
        "authenticated",
        "awakening",
        "sanctuary_prompts",
        "available_instruments",
        "locked_instruments",
        "latest_reading_title",
        "latest_reading_summary",
        "source",
        "mode",
    }
    missing = required - payload.keys()
    if missing:
        raise ValueError(f"Missing required fields: {sorted(missing)}")

    if payload.get("source") != "secretenergy.com":
        raise ValueError("Unexpected source")
    if payload.get("mode") != "read_only":
        raise ValueError("Worker did not confirm read_only mode")
    if not isinstance(payload.get("authenticated"), bool):
        raise ValueError("authenticated must be a boolean")
    if not isinstance(payload.get("awakening"), dict):
        raise ValueError("awakening must be an object")

    for key in ("sanctuary_prompts", "available_instruments", "locked_instruments"):
        if not isinstance(payload.get(key), list):
            raise ValueError(f"{key} must be an array")

    return payload


async def main() -> int:
    if not API_KEY:
        print("SKYVERN_API_KEY is required", file=sys.stderr)
        return 2

    client = Skyvern(api_key=API_KEY, base_url=BASE_URL)

    result = await client.run_task(
        prompt=READ_ONLY_PROMPT,
        url=SECRET_ENERGY_URL,
        wait_for_completion=True,
    )

    raw = _extract_output(result)
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        print("Skyvern output was not valid JSON", file=sys.stderr)
        print(raw, file=sys.stderr)
        raise SystemExit(3) from exc

    payload = _validate_contract(payload)
    print(json.dumps(payload, indent=2, sort_keys=True))
    return 0 if payload["authenticated"] else 4


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
