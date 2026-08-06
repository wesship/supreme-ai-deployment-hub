"""Secure Vapi + ElevenLabs + Hermes voice orchestration endpoints."""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import re
import time
from collections import OrderedDict
from typing import Any

import httpx
from fastapi import APIRouter, Header, HTTPException, Request, status

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/voice", tags=["voice-orchestration"])

_MAX_BODY_BYTES = 1_000_000
_MAX_CACHE_ITEMS = 2_000
_IDEMPOTENCY_TTL_SECONDS = 86_400
_seen_events: OrderedDict[str, float] = OrderedDict()
_SENSITIVE_KEY = re.compile(r"api[_-]?key|authorization|token|secret|password|credential", re.I)


def _configured(name: str) -> bool:
    value = os.getenv(name, "").strip()
    return bool(value and not value.lower().startswith(("paste_", "change_me", "your_", "placeholder")))


def _redact(value: Any) -> Any:
    if isinstance(value, list):
        return [_redact(item) for item in value]
    if not isinstance(value, dict):
        return value
    return {
        key: "[REDACTED]" if _SENSITIVE_KEY.search(key) else _redact(item)
        for key, item in value.items()
    }


def _event_id(payload: dict[str, Any], raw_body: bytes) -> str:
    candidate = (
        payload.get("id")
        or payload.get("eventId")
        or payload.get("message", {}).get("id")
        or payload.get("call", {}).get("id")
    )
    return str(candidate) if candidate else hashlib.sha256(raw_body).hexdigest()


def _remember_once(event_id: str) -> bool:
    now = time.time()
    while _seen_events:
        _, timestamp = next(iter(_seen_events.items()))
        if now - timestamp <= _IDEMPOTENCY_TTL_SECONDS:
            break
        _seen_events.popitem(last=False)
    if event_id in _seen_events:
        return False
    _seen_events[event_id] = now
    _seen_events.move_to_end(event_id)
    while len(_seen_events) > _MAX_CACHE_ITEMS:
        _seen_events.popitem(last=False)
    return True


def _verify_request(raw_body: bytes, authorization: str | None, signature: str | None) -> None:
    bearer_secret = os.getenv("VAPI_WEBHOOK_SECRET", "").strip()
    signing_secret = os.getenv("VAPI_SIGNING_SECRET", "").strip()
    if not bearer_secret and not signing_secret:
        raise HTTPException(status_code=503, detail="Vapi webhook authentication is not configured")

    bearer_valid = False
    if bearer_secret and authorization:
        scheme, _, token = authorization.partition(" ")
        bearer_valid = scheme.lower() == "bearer" and hmac.compare_digest(token.strip(), bearer_secret)

    signature_valid = False
    if signing_secret and signature:
        supplied = signature.removeprefix("sha256=").strip().lower()
        expected = hmac.new(signing_secret.encode(), raw_body, hashlib.sha256).hexdigest()
        signature_valid = hmac.compare_digest(supplied, expected)

    if not bearer_valid and not signature_valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Vapi webhook authentication")


@router.get("/health")
async def voice_health() -> dict[str, Any]:
    checks = {
        "vapi_public_configuration": _configured("VAPI_ASSISTANT_ID") or _configured("VITE_VAPI_ASSISTANT_ID"),
        "vapi_private_key": _configured("VAPI_PRIVATE_KEY") or _configured("VAPI_API_KEY"),
        "vapi_webhook_auth": _configured("VAPI_WEBHOOK_SECRET") or _configured("VAPI_SIGNING_SECRET"),
        "elevenlabs": _configured("ELEVENLABS_API_KEY"),
        "hermes_relay": _configured("HERMES_VOICE_URL"),
    }
    return {
        "status": "configured" if all(checks.values()) else "partial",
        "provider": "vapi+elevenlabs",
        "checks": checks,
        "secrets_exposed": False,
    }


@router.post("/vapi/webhook")
async def vapi_webhook(
    request: Request,
    authorization: str | None = Header(default=None),
    x_vapi_signature: str | None = Header(default=None, alias="x-vapi-signature"),
) -> dict[str, Any]:
    raw_body = await request.body()
    if len(raw_body) > _MAX_BODY_BYTES:
        raise HTTPException(status_code=413, detail="Webhook payload too large")
    _verify_request(raw_body, authorization, x_vapi_signature)

    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Webhook payload must be an object")

    event_id = _event_id(payload, raw_body)
    if not _remember_once(event_id):
        return {"ok": True, "duplicate": True, "event_id": event_id}

    event_type = str(payload.get("type") or payload.get("message", {}).get("type") or "unknown")
    relay_url = os.getenv("HERMES_VOICE_URL", "").strip()
    if not relay_url:
        logger.info("Vapi event accepted without Hermes relay event=%s id=%s", event_type, event_id)
        return {"ok": True, "relayed": False, "event_id": event_id, "event_type": event_type}

    relay_headers = {"Content-Type": "application/json", "X-D3VONN-Event-ID": event_id}
    relay_token = os.getenv("HERMES_VOICE_TOKEN", "").strip()
    if relay_token:
        relay_headers["Authorization"] = f"Bearer {relay_token}"

    relay_payload = {
        "source": "vapi",
        "event_id": event_id,
        "event_type": event_type,
        "received_at": int(time.time()),
        "payload": _redact(payload),
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(relay_url, json=relay_payload, headers=relay_headers)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.exception("Hermes voice relay failed event=%s id=%s", event_type, event_id)
        raise HTTPException(status_code=502, detail="Hermes voice relay failed") from exc

    return {"ok": True, "relayed": True, "event_id": event_id, "event_type": event_type}
