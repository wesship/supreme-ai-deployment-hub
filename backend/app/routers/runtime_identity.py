"""Repository/runtime identity for frontend-backend source-of-truth verification."""
from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter

router = APIRouter(prefix="/runtime", tags=["runtime-identity"])

_REPOSITORY = "wesship/supreme-ai-deployment-hub"
_CONTRACT_VERSION = "1.0"


def _commit_sha() -> str | None:
    for name in (
        "RAILWAY_GIT_COMMIT_SHA",
        "VERCEL_GIT_COMMIT_SHA",
        "GIT_COMMIT_SHA",
        "COMMIT_SHA",
    ):
        value = os.getenv(name, "").strip()
        if value:
            return value
    return None


@router.get("/identity")
async def runtime_identity() -> dict[str, Any]:
    """Return non-sensitive deployment identity used by the D3VONN frontend."""
    return {
        "service": "d3vonn-api",
        "repository": _REPOSITORY,
        "contract_version": _CONTRACT_VERSION,
        "commit_sha": _commit_sha(),
        "ui_authority": "repository",
    }
