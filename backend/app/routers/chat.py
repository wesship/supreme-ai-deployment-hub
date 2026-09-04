"""
Devonn.ai Backend Proxy — /api/chat
Streaming LLM proxy. Forwards requests to OpenAI using server-side OPENAI_API_KEY.
Supports SSE streaming and non-streaming (tool-calling) responses.
"""
import json
import logging
from typing import AsyncGenerator

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from backend.app.config import get_settings
from backend.app.middleware.auth import get_current_user_id
from backend.app.middleware.rate_limit import rate_limit
from backend.app.models.proxy import ChatRequest

logger = logging.getLogger(__name__)
router = APIRouter()

OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"

_PROVIDER_CAPACITY_CODES = {"insufficient_quota", "billing_hard_limit_reached"}
_PROVIDER_CAPACITY_MESSAGE = (
    "D3VONN AI is temporarily unavailable because the upstream provider cannot "
    "accept this request right now. Please try again later."
)
_RATE_LIMIT_MESSAGE = (
    "D3VONN AI is receiving too many requests right now. Please wait a moment "
    "and try again."
)


def _provider_error_message(status_code: int, response_body: str) -> str:
    """Return a user-safe provider error without leaking upstream response data."""
    error_code = ""
    error_type = ""
    provider_message = ""
    try:
        parsed = json.loads(response_body)
        error = parsed.get("error", {}) if isinstance(parsed, dict) else {}
        if isinstance(error, dict):
            error_code = str(error.get("code") or "").lower()
            error_type = str(error.get("type") or "").lower()
            provider_message = str(error.get("message") or "").lower()
    except (json.JSONDecodeError, TypeError, ValueError):
        pass

    capacity_markers = (
        "no credits",
        "credits remaining",
        "insufficient quota",
        "quota exceeded",
        "billing hard limit",
    )
    if (
        error_code in _PROVIDER_CAPACITY_CODES
        or error_type in _PROVIDER_CAPACITY_CODES
        or any(marker in provider_message for marker in capacity_markers)
    ):
        return _PROVIDER_CAPACITY_MESSAGE
    if status_code == 429:
        return _RATE_LIMIT_MESSAGE
    return f"D3VONN AI provider request failed (HTTP {status_code}). Please try again."


async def _stream_openai(payload: dict, api_key: str) -> AsyncGenerator[bytes, None]:
    """
    Forward a streaming request to OpenAI and yield SSE chunks.
    Translates OpenAI SSE format to Devonn proxy SSE format:
      data: {"delta": "token", "done": false, "provider": "openai", "model": "..."}
    """
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream("POST", OPENAI_CHAT_URL, json=payload, headers=headers) as resp:
            if resp.status_code != 200:
                error_body = await resp.aread()
                err_text = error_body.decode("utf-8", errors="replace")
                logger.error("OpenAI error %d: %s", resp.status_code, err_text[:500])
                error_chunk = json.dumps({
                    "delta": "",
                    "done": True,
                    "error": _provider_error_message(resp.status_code, err_text),
                })
                yield f"data: {error_chunk}\n\n".encode()
                return

            model = payload.get("model", "gpt-4.1-mini")
            buffer = ""

            async for raw_chunk in resp.aiter_bytes():
                buffer += raw_chunk.decode("utf-8", errors="replace")
                lines = buffer.split("\n")
                buffer = lines.pop()

                for line in lines:
                    line = line.strip()
                    if not line:
                        continue
                    if line == "data: [DONE]":
                        done_chunk = json.dumps({"delta": "", "done": True, "provider": "openai", "model": model})
                        yield f"data: {done_chunk}\n\n".encode()
                        return
                    if line.startswith("data: "):
                        try:
                            data = json.loads(line[6:])
                            delta = data.get("choices", [{}])[0].get("delta", {}).get("content", "")
                            if delta:
                                chunk = json.dumps({"delta": delta, "done": False, "provider": "openai", "model": model})
                                yield f"data: {chunk}\n\n".encode()
                        except (json.JSONDecodeError, IndexError, KeyError):
                            pass

    done_chunk = json.dumps({"delta": "", "done": True, "provider": "openai", "model": payload.get("model", "gpt-4.1-mini")})
    yield f"data: {done_chunk}\n\n".encode()


@router.post(
    "/chat",
    summary="LLM Chat Proxy",
    description="Proxy chat completions to OpenAI. Supports SSE streaming and tool-calling.",
)
async def chat_proxy(
    request: ChatRequest,
    user_id: str = Depends(get_current_user_id),
    _rate: None = Depends(rate_limit(20)),
) -> StreamingResponse:
    settings = get_settings()

    if not settings.openai_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LLM service not configured (OPENAI_API_KEY missing on server)",
        )

    payload: dict = {
        "model": request.model,
        "messages": [m.model_dump() for m in request.messages],
        "max_tokens": request.max_tokens,
        "temperature": request.temperature,
        "stream": request.stream,
    }

    if request.tools:
        payload["tools"] = [t.model_dump() for t in request.tools]
        payload["tool_choice"] = request.tool_choice or "auto"

    logger.info("chat_proxy request accepted stream=%s", request.stream)

    if not request.stream:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                OPENAI_CHAT_URL,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {settings.openai_api_key}",
                },
            )
        if resp.status_code != 200:
            logger.error("OpenAI error %d: %s", resp.status_code, resp.text[:500])
            raise HTTPException(
                status_code=resp.status_code,
                detail=_provider_error_message(resp.status_code, resp.text),
            )
        return resp.json()  # type: ignore[return-value]

    return StreamingResponse(
        _stream_openai(payload, settings.openai_api_key),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
