"""Opt-in, isolated public AI preview. No Hermes tools, user data, or streaming URLs."""
import os
import ipaddress
import hashlib
import time

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from redis.asyncio import Redis

from backend.app.config import get_settings

router = APIRouter(prefix="/api/public", tags=["public-demo"])
_ALLOWED_ORIGINS = {"https://d3vonn.io", "https://www.d3vonn.io"}
_SYSTEM = "You are a limited public demonstration of D3VONN.IO. Answer general questions briefly. Never claim to access a user's private data or execute actions. No tools are available."

class PreviewPrompt(BaseModel):
    prompt: str = Field(min_length=1, max_length=500)

def _enabled() -> bool:
    return os.getenv("PUBLIC_AI_DEMO_ENABLED", "").lower() == "true"

def _identity(request: Request) -> str:
    # Do not trust client-supplied forwarded headers.
    host = request.client.host if request.client else "unknown"
    try:
        host = str(ipaddress.ip_address(host))
    except ValueError:
        host = "unknown"
    return hashlib.sha256(host.encode()).hexdigest()[:24]

async def _reserve(request: Request) -> None:
    url = os.getenv("REDIS_URL", "").strip()
    if not url:
        raise HTTPException(503, "Public demo limiter unavailable")
    redis = Redis.from_url(url, decode_responses=True, socket_connect_timeout=2, socket_timeout=2)
    try:
        key = f"d3vonn:public-demo:{_identity(request)}:{int(time.time() // 3600)}"
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, 3601)
    except Exception:
        raise HTTPException(503, "Public demo limiter unavailable")
    finally:
        await redis.aclose()
    if count > 5:
        raise HTTPException(429, "Public demo limit reached. Please try later.")

@router.post("/agent-preview")
async def agent_preview(body: PreviewPrompt, request: Request):
    if not _enabled():
        raise HTTPException(503, "Public AI preview is not enabled")
    origin = request.headers.get("origin")
    if origin not in _ALLOWED_ORIGINS:
        raise HTTPException(403, "Origin not permitted")
    await _reserve(request)
    settings = get_settings()
    if not settings.openai_api_key:
        raise HTTPException(503, "Public AI preview unavailable")
    payload = {
        "model": os.getenv("PUBLIC_AI_DEMO_MODEL", "gpt-4.1-mini"),
        "messages": [{"role": "system", "content": _SYSTEM}, {"role": "user", "content": body.prompt}],
        "max_tokens": 180,
        "temperature": 0.4,
        "stream": False,
    }
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                json=payload,
            )
            response.raise_for_status()
            answer = response.json()["choices"][0]["message"]["content"]
        if not isinstance(answer, str) or not answer.strip():
            raise ValueError("Empty model output")
    except (httpx.HTTPError, KeyError, IndexError, ValueError, TypeError):
        raise HTTPException(502, "Public AI preview temporarily unavailable")
    return {"answer": answer[:1400], "mode": "restricted-public-preview"}
