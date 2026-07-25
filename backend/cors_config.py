"""CORS origin assembly for the D3VONN.IO backend.

Railway may provide ``ALLOWED_ORIGINS`` for additional deployment surfaces. Those
configured values must extend, rather than replace, the public D3VONN.IO origins.
"""

from __future__ import annotations

REQUIRED_PRODUCTION_ORIGINS: tuple[str, ...] = (
    "https://d3vonn.io",
    "https://www.d3vonn.io",
    "https://app.d3vonn.io",
)


def build_allowed_origins(configured_origins: str | None = None) -> list[str]:
    """Return required production origins plus configured additions.

    Values are trimmed, trailing slashes are removed, and duplicates retain their
    first occurrence. Required production origins always appear first so an
    environment override cannot accidentally disable the public application.
    """

    candidates = [*REQUIRED_PRODUCTION_ORIGINS, *(configured_origins or "").split(",")]
    allowed: list[str] = []
    seen: set[str] = set()

    for candidate in candidates:
        origin = candidate.strip().rstrip("/")
        if not origin or origin in seen:
            continue
        seen.add(origin)
        allowed.append(origin)

    return allowed
