from __future__ import annotations

import os
from typing import Any, Dict

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


PERSONALIVE_URL = os.getenv("PERSONALIVE_URL", "http://personalive:7870").rstrip("/")
ORCHESTRATOR_URL = os.getenv("ORCHESTRATOR_URL", "http://host.docker.internal:8000").rstrip("/")
DEVONN_API_KEY = os.getenv("DEVONN_API_KEY", "")

app = FastAPI(title="Devonn Avatar Gateway", version="0.1.0")


class AvatarRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=4000)
    voice_id: str | None = None
    avatar_id: str | None = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


@app.get("/health")
async def health() -> Dict[str, Any]:
    personalive_ok = False
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(f"{PERSONALIVE_URL}/health")
            personalive_ok = response.status_code < 500
    except Exception:
        personalive_ok = False

    return {
        "status": "ok" if personalive_ok else "degraded",
        "personalive_url": PERSONALIVE_URL,
        "personalive_ok": personalive_ok,
        "orchestrator_url": ORCHESTRATOR_URL,
    }


@app.post("/avatar/session")
async def create_avatar_session(payload: AvatarRequest) -> Dict[str, Any]:
    """Create an avatar session request envelope.

    This endpoint is intentionally conservative: it validates and normalizes the
    request, then forwards it to PersonaLive when the upstream exposes a compatible
    API. If the upstream endpoint differs, this gateway returns a clear 502 rather
    than hiding the failure.
    """
    request_body = payload.model_dump(exclude_none=True)
    headers: Dict[str, str] = {}
    if DEVONN_API_KEY:
        headers["X-Devonn-API-Key"] = DEVONN_API_KEY

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{PERSONALIVE_URL}/api/avatar/session",
                json=request_body,
                headers=headers,
            )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"PersonaLive upstream unavailable: {exc}") from exc

    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail={
                "message": "PersonaLive upstream rejected avatar session request",
                "upstream_status": response.status_code,
                "upstream_excerpt": response.text[:500],
            },
        )

    try:
        upstream_payload = response.json()
    except ValueError:
        upstream_payload = {"raw": response.text}

    return {
        "status": "accepted",
        "upstream": upstream_payload,
        "metadata": payload.metadata,
    }
