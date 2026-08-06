"""Secure Vapi + ElevenLabs + Hermes voice orchestration endpoints."""
from __future__ import annotations

import hashlib
import hmac
import json
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
_PUBLISHED_ASSISTANT_ID = "8491eea7-e385-426b-8cdc-3e2aaf9a4cbf"
_DEFAULT_ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"
_WEBHOOK_DERIVATION_LABEL = b"d3vonn:vapi:webhook:v1"
_ALLOWED_HERMES_TOOLS = {"create_hermes_task", "enqueue_hermes_task", "hermes_task"}
_event_cache: OrderedDict[str, tuple[float, dict[str, Any]]] = OrderedDict()
_SENSITIVE_KEY = re.compile(r"api[_-]?key|authorization|token|secret|password|credential", re.I)


def _env_value(*names: str) -> str:
    for name in names:
        value = os.getenv(name, "").strip()
        if value and not value.lower().startswith(("paste_", "change_me", "your_", "placeholder")):
            return value
    return ""


def _configured(name: str) -> bool:
    return bool(_env_value(name))


def effective_vapi_private_key() -> str:
    """Return the configured server-side Vapi credential without exposing it."""
    return _env_value("VAPI_PRIVATE_KEY", "VAPI_API_KEY")


def effective_webhook_secret() -> str:
    """Return explicit webhook auth or a deterministic secret derived from Vapi's private key."""
    explicit = _env_value("VAPI_WEBHOOK_SECRET")
    if explicit:
        return explicit
    private_key = effective_vapi_private_key()
    if not private_key:
        return ""
    return hmac.new(private_key.encode("utf-8"), _WEBHOOK_DERIVATION_LABEL, hashlib.sha256).hexdigest()


def effective_assistant_id() -> str:
    return _env_value("VAPI_ASSISTANT_ID", "VITE_VAPI_ASSISTANT_ID") or _PUBLISHED_ASSISTANT_ID


def effective_elevenlabs_voice_id() -> str:
    return _env_value("ELEVENLABS_DEFAULT_VOICE_ID", "ELEVENLABS_VOICE_ID") or _DEFAULT_ELEVENLABS_VOICE_ID


def _redact(value: Any) -> Any:
    if isinstance(value, list):
        return [_redact(item) for item in value]
    if not isinstance(value, dict):
        return value
    return {
        key: "[REDACTED]" if _SENSITIVE_KEY.search(key) else _redact(item)
        for key, item in value.items()
    }


def _message(payload: dict[str, Any]) -> dict[str, Any]:
    candidate = payload.get("message")
    return candidate if isinstance(candidate, dict) else payload


def _event_id(payload: dict[str, Any], raw_body: bytes) -> str:
    message = _message(payload)
    candidate = payload.get("id") or payload.get("eventId") or message.get("id")
    return str(candidate) if candidate else hashlib.sha256(raw_body).hexdigest()


def _purge_cache() -> None:
    now = time.time()
    while _event_cache:
        _, (timestamp, _) = next(iter(_event_cache.items()))
        if now - timestamp <= _IDEMPOTENCY_TTL_SECONDS:
            break
        _event_cache.popitem(last=False)


def _cached_response(event_id: str) -> dict[str, Any] | None:
    _purge_cache()
    cached = _event_cache.get(event_id)
    if cached is None:
        return None
    _event_cache.move_to_end(event_id)
    return dict(cached[1])


def _remember_response(event_id: str, response: dict[str, Any]) -> None:
    _purge_cache()
    _event_cache[event_id] = (time.time(), dict(response))
    _event_cache.move_to_end(event_id)
    while len(_event_cache) > _MAX_CACHE_ITEMS:
        _event_cache.popitem(last=False)


def _verify_request(
    raw_body: bytes,
    authorization: str | None,
    signature: str | None,
    vapi_secret: str | None,
) -> None:
    webhook_secret = effective_webhook_secret()
    signing_secret = _env_value("VAPI_SIGNING_SECRET")
    if not webhook_secret and not signing_secret:
        raise HTTPException(status_code=503, detail="Vapi webhook authentication is not configured")

    bearer_valid = False
    if webhook_secret and authorization:
        scheme, _, token = authorization.partition(" ")
        bearer_valid = scheme.lower() == "bearer" and hmac.compare_digest(token.strip(), webhook_secret)

    server_secret_valid = bool(
        webhook_secret
        and vapi_secret
        and hmac.compare_digest(vapi_secret.strip(), webhook_secret)
    )

    signature_valid = False
    if signing_secret and signature:
        supplied = signature.removeprefix("sha256=").strip().lower()
        expected = hmac.new(signing_secret.encode(), raw_body, hashlib.sha256).hexdigest()
        signature_valid = hmac.compare_digest(supplied, expected)

    if not bearer_valid and not server_secret_valid and not signature_valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Vapi webhook authentication")


def _tool_calls(message: dict[str, Any]) -> list[dict[str, Any]]:
    direct = message.get("toolCallList")
    if isinstance(direct, list):
        return [item for item in direct if isinstance(item, dict)]

    normalized: list[dict[str, Any]] = []
    wrapped = message.get("toolWithToolCallList")
    if isinstance(wrapped, list):
        for item in wrapped:
            if not isinstance(item, dict):
                continue
            tool_call = item.get("toolCall")
            if not isinstance(tool_call, dict):
                continue
            normalized.append({"name": item.get("name"), **tool_call})
    return normalized


async def _record_internal_event(event_type: str, event_id: str, payload: dict[str, Any]) -> bool:
    try:
        from backend.hermes.task_engine import log_event

        await log_event(
            event=f"voice.{event_type}",
            message=f"Vapi voice event received: {event_type}",
            data={"source": "vapi", "payload": _redact(payload)},
            correlation_id=event_id,
        )
        return True
    except Exception:  # pragma: no cover - defensive production guard
        logger.exception("Internal Hermes voice event recording failed event=%s id=%s", event_type, event_id)
        return False


async def _handle_tool_calls(message: dict[str, Any], event_id: str) -> dict[str, Any]:
    calls = _tool_calls(message)
    results: list[dict[str, Any]] = []

    for call in calls:
        tool_call_id = str(call.get("id") or "")
        name = str(call.get("name") or "")
        parameters = call.get("parameters")
        if not isinstance(parameters, dict):
            parameters = {}

        if not tool_call_id:
            continue

        if name not in _ALLOWED_HERMES_TOOLS:
            result: Any = {
                "status": "rejected",
                "message": f"Tool '{name or 'unknown'}' is not enabled for D3VONN voice.",
            }
        else:
            try:
                from backend.hermes.task_engine import create_task

                title = str(parameters.get("title") or parameters.get("task") or "Voice-requested Hermes task")
                description = parameters.get("description")
                task = await create_task(
                    title=title[:240],
                    task_type="voice.hermes",
                    description=str(description)[:4000] if description else None,
                    input_data=_redact(parameters),
                    source="vapi",
                    correlation_id=event_id,
                )
                result = {"status": "queued", "task_id": task.get("id"), "title": task.get("title", title)}
            except Exception:  # pragma: no cover - external database failures
                logger.exception("Hermes task creation failed tool_call_id=%s", tool_call_id)
                result = {
                    "status": "unavailable",
                    "message": "Hermes could not queue the task. Please try again later.",
                }

        results.append(
            {
                "name": name,
                "toolCallId": tool_call_id,
                "result": json.dumps(result, separators=(",", ":")),
            }
        )

    return {"results": results}


async def _relay_external(event_type: str, event_id: str, payload: dict[str, Any]) -> bool:
    relay_url = _env_value("HERMES_VOICE_URL")
    if not relay_url:
        return False

    relay_headers = {"Content-Type": "application/json", "X-D3VONN-Event-ID": event_id}
    relay_token = _env_value("HERMES_VOICE_TOKEN")
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
        return True
    except httpx.HTTPError:
        logger.exception("Optional external Hermes voice relay failed event=%s id=%s", event_type, event_id)
        return False


@router.get("/health")
async def voice_health() -> dict[str, Any]:
    vapi_key_ready = bool(effective_vapi_private_key())
    webhook_ready = bool(effective_webhook_secret()) or _configured("VAPI_SIGNING_SECRET")
    checks = {
        "vapi_public_configuration": bool(effective_assistant_id()),
        "vapi_private_key": vapi_key_ready,
        "vapi_webhook_auth": webhook_ready,
        "elevenlabs_api": _configured("ELEVENLABS_API_KEY"),
        "elevenlabs_voice": bool(effective_elevenlabs_voice_id()),
        "hermes_internal_adapter": True,
    }
    return {
        "status": "configured" if all(checks.values()) else "partial",
        "provider": "vapi+elevenlabs",
        "checks": checks,
        "webhook_auth_mode": (
            "explicit"
            if _configured("VAPI_WEBHOOK_SECRET") or _configured("VAPI_SIGNING_SECRET")
            else "derived"
            if vapi_key_ready
            else "unavailable"
        ),
        "optional_external_relay": _configured("HERMES_VOICE_URL"),
        "secrets_exposed": False,
    }


@router.post("/vapi/webhook")
async def vapi_webhook(
    request: Request,
    authorization: str | None = Header(default=None),
    x_vapi_signature: str | None = Header(default=None, alias="x-vapi-signature"),
    x_vapi_secret: str | None = Header(default=None, alias="x-vapi-secret"),
) -> dict[str, Any]:
    raw_body = await request.body()
    if len(raw_body) > _MAX_BODY_BYTES:
        raise HTTPException(status_code=413, detail="Webhook payload too large")
    _verify_request(raw_body, authorization, x_vapi_signature, x_vapi_secret)

    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Webhook payload must be an object")

    event_id = _event_id(payload, raw_body)
    cached = _cached_response(event_id)
    if cached is not None:
        cached["duplicate"] = True
        return cached

    message = _message(payload)
    event_type = str(message.get("type") or payload.get("type") or "unknown")

    if event_type == "assistant-request":
        response = {"assistantId": effective_assistant_id()}
    elif event_type == "tool-calls":
        response = await _handle_tool_calls(message, event_id)
    else:
        internal_recorded = await _record_internal_event(event_type, event_id, payload)
        external_relay = await _relay_external(event_type, event_id, payload)
        response = {
            "ok": True,
            "event_id": event_id,
            "event_type": event_type,
            "hermes_recorded": internal_recorded,
            "external_relay": external_relay,
        }

    _remember_response(event_id, response)
    return response
