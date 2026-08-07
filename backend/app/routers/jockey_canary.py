"""Secret-protected production canary for TwelveLabs/Jockey film intelligence."""
from __future__ import annotations

import hmac

from fastapi import APIRouter, Header, HTTPException, status

from backend.app.routers.voice_orchestration import (
    _query_film_intelligence,
    effective_webhook_secret,
)

router = APIRouter(prefix="/voice", tags=["voice-jockey-certification"])


@router.post("/jockey/certify")
async def certify_jockey_round_trip(
    x_vapi_secret: str | None = Header(default=None),
) -> dict[str, object]:
    """Exercise one real Jockey reasoning call without returning film content.

    This endpoint exists only for protected production certification. It reuses
    the same server-side Jockey function as the authenticated Vapi tool and
    accepts the already-protected Vapi webhook secret. Provider output is never
    included in the response.
    """
    expected = effective_webhook_secret()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Voice webhook authentication is not configured",
        )
    if not x_vapi_secret or not hmac.compare_digest(x_vapi_secret.strip(), expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid certification credential",
        )

    result = await _query_film_intelligence(
        {
            "mode": "reason",
            "query": (
                "Confirm in one concise sentence whether the configured AI Films "
                "knowledge store contains indexed film material. Do not quote or "
                "reproduce transcript text."
            ),
            "instructions": (
                "This is a production health canary. Be concise and do not expose "
                "sensitive metadata or transcript content."
            ),
        }
    )
    if result.get("status") != "ok":
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Jockey reasoning canary failed",
        )

    return {
        "ok": True,
        "provider": result.get("provider") or "twelvelabs-jockey",
        "mode": result.get("mode") or "reason",
        "round_trip": True,
        "content_returned": False,
    }
