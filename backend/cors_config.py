"""Production-safe CORS origin configuration for the D3VONN.IO backend."""
from __future__ import annotations

from collections.abc import Iterable

PRODUCTION_ORIGINS: tuple[str, ...] = (
    "https://d3vonn.io",
    "https://www.d3vonn.io",
    "https://app.d3vonn.io",
)


def build_allowed_origins(configured_origins: str | None) -> list[str]:
    """Return a deduplicated allowlist that always includes official origins.

    Railway and other deployment environments may provide ``ALLOWED_ORIGINS``
    for additional preview or internal clients. Those values extend the
    official D3VONN.IO production origins instead of replacing them.
    """
    configured: Iterable[str] = (
        origin.strip()
        for origin in (configured_origins or "").split(",")
        if origin.strip()
    )
    return list(dict.fromkeys((*PRODUCTION_ORIGINS, *configured)))
