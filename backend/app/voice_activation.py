"""Railway-native Vapi + ElevenLabs activation and Hermes certification."""
from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Any

import httpx

from backend.app.routers.voice_orchestration import (
    effective_assistant_id,
    effective_elevenlabs_voice_id,
    effective_vapi_private_key,
    effective_webhook_secret,
)

logger = logging.getLogger(__name__)
_DEFAULT_MODEL = "eleven_turbo_v2_5"
_FALSE_VALUES = {"0", "false", "no", "off", "disabled"}
_TRUE_VALUES = {"1", "true", "yes", "on", "enabled"}
_SUPPORTED_VAPI_SERVER_MESSAGES = {
    "assistant.started",
    "assistant.speechStarted",
    "conversation-update",
    "end-of-call-report",
    "function-call",
    "hang",
    "language-changed",
    "language-change-detected",
    "model-output",
    "phone-call-control",
    "speech-update",
    "status-update",
    "transcript",
    'transcript[transcriptType="final"]',
    "tool-calls",
    "transfer-destination-request",
    "handoff-destination-request",
    "transfer-update",
    "user-interrupted",
    "voice-input",
    "chat.created",
    "chat.deleted",
    "session.created",
    "session.updated",
    "session.deleted",
    "call.deleted",
    "call.delete.failed",
}
_REQUIRED_VAPI_SERVER_MESSAGES = {
    "tool-calls",
    "status-update",
    "end-of-call-report",
    "transcript",
}


def _enabled() -> bool:
    return os.getenv("D3VONN_VOICE_AUTO_ACTIVATE", "true").strip().lower() not in _FALSE_VALUES


def _direct_elevenlabs_validation_enabled() -> bool:
    """Only probe ElevenLabs directly when direct BYOK delivery is being tested."""
    return (
        os.getenv("D3VONN_VALIDATE_DIRECT_ELEVENLABS", "false").strip().lower()
        in _TRUE_VALUES
    )


def _safe_error(exc: Exception, secrets: tuple[str, ...]) -> str:
    message = f"{type(exc).__name__}: {exc}"
    if isinstance(exc, httpx.HTTPStatusError):
        try:
            payload = exc.response.json()
        except ValueError:
            payload = None
        if isinstance(payload, dict):
            detail = payload.get("message") or payload.get("error")
            if detail:
                message = f"{message}; provider_detail={detail}"
    for secret in secrets:
        if secret:
            message = message.replace(secret, "[REDACTED]")
    return message[:1000]


def _normalized_server_messages(value: Any) -> list[str]:
    """Return a Vapi-schema-safe event list plus D3VONN's required events."""
    messages = (
        {
            item
            for item in value
            if isinstance(item, str) and item in _SUPPORTED_VAPI_SERVER_MESSAGES
        }
        if isinstance(value, list)
        else set()
    )
    messages.update(_REQUIRED_VAPI_SERVER_MESSAGES)
    return sorted(messages)


async def _emit(
    event: str,
    message: str,
    *,
    level: str = "info",
    data: dict[str, Any] | None = None,
    correlation_id: str | None = None,
) -> None:
    try:
        from backend.hermes.task_engine import log_event

        await log_event(
            event=event,
            message=message,
            level=level,
            data=data,
            correlation_id=correlation_id,
        )
    except Exception as exc:  # pragma: no cover - defensive observability guard
        logger.warning("Voice activation event persistence failed: %s", exc)


async def _inspect_direct_elevenlabs_key(
    client: httpx.AsyncClient,
    api_key: str,
    voice_id: str,
    correlation_id: str,
) -> tuple[str, str | None]:
    """Inspect optional ElevenLabs BYOK access without blocking Vapi-managed voice."""
    if not api_key:
        return "not_configured", None
    if not _direct_elevenlabs_validation_enabled():
        return "validation_disabled", None

    try:
        response = await client.get(
            f"https://api.elevenlabs.io/v1/voices/{voice_id}",
            headers={"xi-api-key": api_key},
        )
        response.raise_for_status()
        payload = response.json()
        if payload.get("voice_id") != voice_id:
            return "voice_mismatch", None
        return "valid", payload.get("name")
    except httpx.HTTPStatusError as exc:
        status_code = exc.response.status_code
        direct_status = "invalid_or_expired" if status_code == 401 else f"http_{status_code}"
        try:
            detail = exc.response.json().get("detail")
        except (AttributeError, ValueError):
            detail = None
        if (
            status_code == 401
            and isinstance(detail, dict)
            and detail.get("status") == "missing_permissions"
        ):
            direct_status = f"missing_permission:{detail.get('message', 'restricted_key')}"
        await _emit(
            "voice.activation.direct_elevenlabs_degraded",
            "Direct ElevenLabs BYOK access is unavailable; Vapi-managed ElevenLabs remains active.",
            level="warn",
            data={
                "direct_api_status": direct_status,
                "http_status": status_code,
                "voice_id": voice_id,
                "fallback": "vapi-managed-elevenlabs",
            },
            correlation_id=correlation_id,
        )
        return direct_status, None
    except Exception as exc:  # noqa: BLE001
        await _emit(
            "voice.activation.direct_elevenlabs_degraded",
            "Direct ElevenLabs BYOK validation could not complete; Vapi-managed ElevenLabs remains active.",
            level="warn",
            data={
                "direct_api_status": "validation_error",
                "error_type": type(exc).__name__,
                "voice_id": voice_id,
                "fallback": "vapi-managed-elevenlabs",
            },
            correlation_id=correlation_id,
        )
        return "validation_error", None


async def activate_voice_runtime() -> None:
    """Configure provider state from Railway env and certify the local webhook path."""
    if not _enabled():
        logger.info("Railway-native voice activation disabled by configuration.")
        return

    delay = max(0.0, float(os.getenv("D3VONN_VOICE_ACTIVATION_DELAY_SECONDS", "8")))
    await asyncio.sleep(delay)

    vapi_key = effective_vapi_private_key()
    assistant_id = effective_assistant_id()
    webhook_secret = effective_webhook_secret()
    elevenlabs_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    voice_id = effective_elevenlabs_voice_id()
    voice_model = os.getenv("ELEVENLABS_DEFAULT_MODEL", _DEFAULT_MODEL).strip() or _DEFAULT_MODEL
    deployment_id = os.getenv("RAILWAY_DEPLOYMENT_ID", "unknown")
    correlation_id = f"voice-activation-{deployment_id}-{int(time.time())}"

    readiness = {
        "vapi_private_key": bool(vapi_key),
        "vapi_assistant_id": bool(assistant_id),
        "vapi_webhook_auth": bool(webhook_secret),
        "elevenlabs_voice_id": bool(voice_id),
        "elevenlabs_direct_key_present": bool(elevenlabs_key),
        "elevenlabs_direct_validation": _direct_elevenlabs_validation_enabled(),
        "voice_delivery_mode": "vapi-managed-elevenlabs",
        "webhook_auth_mode": "explicit" if os.getenv("VAPI_WEBHOOK_SECRET", "").strip() else "derived",
        "deployment_id": deployment_id,
    }
    required_names = (
        "vapi_private_key",
        "vapi_assistant_id",
        "vapi_webhook_auth",
        "elevenlabs_voice_id",
    )
    missing = [name for name in required_names if not readiness[name]]
    if missing:
        await _emit(
            "voice.activation.blocked",
            "Railway voice activation is blocked by missing core configuration.",
            level="warn",
            data={"missing": missing, "readiness": readiness},
            correlation_id=correlation_id,
        )
        logger.warning("Voice activation blocked; missing=%s", missing)
        return

    await _emit(
        "voice.activation.started",
        "Railway-native Vapi-managed ElevenLabs activation started.",
        data={
            "assistant_id": assistant_id,
            "voice_id": voice_id,
            "voice_model": voice_model,
            "readiness": readiness,
        },
        correlation_id=correlation_id,
    )

    redaction_values = (vapi_key, webhook_secret, elevenlabs_key)
    try:
        timeout = httpx.Timeout(30.0, connect=15.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            vapi_headers = {"Authorization": f"Bearer {vapi_key}"}
            assistant_response = await client.get(
                f"https://api.vapi.ai/assistant/{assistant_id}",
                headers=vapi_headers,
            )
            assistant_response.raise_for_status()
            assistant = assistant_response.json()
            if assistant.get("id") != assistant_id:
                raise RuntimeError("Vapi returned an unexpected assistant identifier")

            direct_api_status, voice_name = await _inspect_direct_elevenlabs_key(
                client,
                elevenlabs_key,
                voice_id,
                correlation_id,
            )

            current_voice = assistant.get("voice") if isinstance(assistant.get("voice"), dict) else {}
            allowed_voice_fields = {
                "stability",
                "similarityBoost",
                "style",
                "speed",
                "useSpeakerBoost",
                "optimizeStreamingLatency",
                "pronunciationDictionaryLocators",
            }
            voice_config = {
                key: value for key, value in current_voice.items() if key in allowed_voice_fields
            }
            voice_config.update(
                {
                    "provider": "11labs",
                    "voiceId": voice_id,
                    "model": voice_model,
                }
            )

            server_messages = _normalized_server_messages(
                assistant.get("serverMessages")
            )
            webhook_url = os.getenv(
                "D3VONN_VAPI_WEBHOOK_URL",
                "https://api.d3vonn.io/api/voice/vapi/webhook",
            ).strip()
            patch_payload = {
                "server": {
                    "url": webhook_url,
                    "secret": webhook_secret,
                    "timeoutSeconds": 20,
                },
                "serverMessages": server_messages,
                "voice": voice_config,
            }
            patch_response = await client.patch(
                f"https://api.vapi.ai/assistant/{assistant_id}",
                headers={**vapi_headers, "Content-Type": "application/json"},
                json=patch_payload,
            )
            patch_response.raise_for_status()
            updated = patch_response.json()
            updated_server = updated.get("server") if isinstance(updated.get("server"), dict) else {}
            updated_voice = updated.get("voice") if isinstance(updated.get("voice"), dict) else {}
            if updated_server.get("url") != webhook_url:
                raise RuntimeError("Vapi did not persist the D3VONN webhook URL")
            if updated_voice.get("provider") != "11labs" or updated_voice.get("voiceId") != voice_id:
                raise RuntimeError("Vapi did not persist the ElevenLabs voice configuration")

        await _emit(
            "voice.activation.providers_configured",
            "Vapi assistant and Vapi-managed ElevenLabs voice configuration verified.",
            data={
                "assistant_id": assistant_id,
                "voice_id": voice_id,
                "voice_model": voice_model,
                "webhook_url": webhook_url,
                "voice_delivery_mode": "vapi-managed-elevenlabs",
                "direct_elevenlabs_api_status": direct_api_status,
                "elevenlabs_voice_name": voice_name,
            },
            correlation_id=correlation_id,
        )

        port = os.getenv("PORT", "8000").strip() or "8000"
        internal_url = os.getenv(
            "D3VONN_VOICE_INTERNAL_WEBHOOK_URL",
            f"http://127.0.0.1:{port}/api/voice/vapi/webhook",
        ).strip()
        certification_event_id = f"{correlation_id}-webhook"
        async with httpx.AsyncClient(timeout=20.0) as client:
            certification_response = await client.post(
                internal_url,
                headers={"x-vapi-secret": webhook_secret},
                json={
                    "message": {
                        "id": certification_event_id,
                        "type": "status-update",
                        "status": "vapi-managed-elevenlabs-certified",
                    }
                },
            )
            certification_response.raise_for_status()
            certification = certification_response.json()
        if certification.get("ok") is not True or certification.get("event_id") != certification_event_id:
            raise RuntimeError("Local Vapi webhook certification returned an unexpected result")
        if certification.get("hermes_recorded") is not True:
            raise RuntimeError("Hermes did not accept the local Vapi certification event")

        await _emit(
            "voice.activation.certified",
            "Vapi-managed ElevenLabs, Railway routing, and Hermes persistence certified.",
            data={
                "assistant_id": assistant_id,
                "voice_id": voice_id,
                "voice_model": voice_model,
                "webhook_url": webhook_url,
                "voice_delivery_mode": "vapi-managed-elevenlabs",
                "direct_elevenlabs_api_status": direct_api_status,
                "certification_event_id": certification_event_id,
                "deployment_id": deployment_id,
            },
            correlation_id=correlation_id,
        )
        logger.info("Railway-native Vapi-managed ElevenLabs activation certified successfully.")
    except Exception as exc:  # noqa: BLE001
        safe_error = _safe_error(exc, redaction_values)
        await _emit(
            "voice.activation.failed",
            "Railway-native voice activation failed.",
            level="error",
            data={
                "error": safe_error,
                "assistant_id": assistant_id,
                "voice_id": voice_id,
                "deployment_id": deployment_id,
            },
            correlation_id=correlation_id,
        )
        logger.error("Railway-native voice activation failed: %s", safe_error)
