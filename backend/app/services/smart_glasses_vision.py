"""Internal smart-glasses vision adapter using the server-side OpenAI key.

This module handles only low-risk visual understanding actions for SG-01B. It
never mutates state and never logs raw image payloads.
"""
from __future__ import annotations

import os
from typing import Any

import httpx
from fastapi import HTTPException, status

OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
SUPPORTED_ACTIONS = {"describe_scene", "read_text"}


def _extract_output_text(response: dict[str, Any]) -> str:
    parts: list[str] = []
    for item in response.get("output", []):
        if not isinstance(item, dict) or item.get("type") != "message":
            continue
        for content in item.get("content", []):
            if isinstance(content, dict) and content.get("type") == "output_text":
                text = content.get("text")
                if isinstance(text, str) and text.strip():
                    parts.append(text.strip())
    return "\n".join(parts).strip()


def _image_url(payload: dict[str, Any]) -> str:
    image = payload.get("image_data") or payload.get("image_url")
    if not isinstance(image, str) or not image.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Smart-glasses vision requires image_data or image_url",
        )
    return image.strip()


async def run_vision_action(*, action: str, payload: dict[str, Any], correlation_id: str) -> dict[str, Any]:
    if action not in SUPPORTED_ACTIONS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unsupported vision action")

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Internal smart-glasses vision is not configured",
        )

    prompt = (
        "Describe the visible scene accurately and concisely for a smart-glasses user. "
        "Do not infer sensitive attributes or identities that are not explicitly visible."
        if action == "describe_scene"
        else "Read and return the visible text accurately. Preserve important ordering and line breaks when useful."
    )
    model = os.getenv("SMART_GLASSES_VISION_MODEL", "gpt-5.6-luna").strip() or "gpt-5.6-luna"
    request_body = {
        "model": model,
        "input": [
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": prompt},
                    {"type": "input_image", "image_url": _image_url(payload)},
                ],
            }
        ],
        "max_output_tokens": 300,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "X-Client-Request-Id": correlation_id,
    }
    timeout = float(os.getenv("SMART_GLASSES_UPSTREAM_TIMEOUT_SECONDS", "20"))
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(OPENAI_RESPONSES_URL, json=request_body, headers=headers)
        response.raise_for_status()
        body = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Internal smart-glasses vision request failed",
        ) from exc

    text = _extract_output_text(body)
    if not text:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Internal smart-glasses vision returned no text",
        )
    return {
        "agent_used": "D3VONN Vision",
        "model_used": body.get("model", model) if isinstance(body, dict) else model,
        "text": text,
    }
