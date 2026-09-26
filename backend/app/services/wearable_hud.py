"""Vendor-neutral wearable HUD response shaping for display-capable clients."""
from __future__ import annotations

from typing import Any

MAX_HUD_TEXT = 1000
DEFAULT_TTL_MS = 8000
MAX_TTL_MS = 60000


def _extract_text(result: Any) -> str | None:
    if isinstance(result, str):
        text = result.strip()
        return text or None
    if not isinstance(result, dict):
        return None

    for key in ("text", "summary", "message", "answer", "content"):
        value = result.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    nested = result.get("result")
    if nested is not result:
        return _extract_text(nested)
    return None


def build_hud_instruction(
    result: Any,
    *,
    surface: str = "primary",
    ttl_ms: int = DEFAULT_TTL_MS,
    priority: str = "normal",
) -> dict[str, Any] | None:
    text = _extract_text(result)
    if not text:
        return None
    if ttl_ms < 500 or ttl_ms > MAX_TTL_MS:
        raise ValueError("ttl_ms out of bounds")
    if priority not in {"normal", "high"}:
        raise ValueError("unsupported HUD priority")
    if surface not in {"primary", "notification", "caption", "task", "context"}:
        raise ValueError("unsupported HUD surface")

    return {
        "action": "display.hud.render",
        "surface": surface,
        "text": text[:MAX_HUD_TEXT],
        "ttl_ms": ttl_ms,
        "priority": priority,
    }
