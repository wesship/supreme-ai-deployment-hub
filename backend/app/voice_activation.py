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


def _enabled() -> bool:
    return os.getenv("D3VONN_VOICE_AUTO_ACTIVATE", "true").strip().lower() not in _FALSE_VALUES


def _safe_error(exc: Exception, secrets: tuple[str, ...]) -> str:
    message = f"{type(exc).__name__}: {exc}"
    for secret in secrets:
        if secret:
            message = message.replace(secret, "[REDACTED]")
    return message[:1000]


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
        "elevenlabs_api_key": bool(elevenlabs_key),
        "elevenlabs_voice_id": bool(voice_id),
        "webhook_auth_mode": "explicit" if os.getenv("VAPI_WEBHOOK_SECRET", "").strip() else "derived",
        "deployment_id": deployment_id,
    }
    missing = [name for name, ready in readiness.items() if name not in {"webhook_auth_mode", "deployment_id"} and not ready]
    if missing:
        await _emit(
            "voice.activation.blocked",
            "Railway voice activation is blocked by missing provider configuration.",
            level="warning",
            data={"missing": missing, "readiness": readiness},
            correlation_id=correlation_id,
        )
        logger.warning("Voice activation blocked; missing=%s", missing)
        return

    await _emit(
        "voice.activation.started",
        "Railway-native Vapi and ElevenLabs activation started.",
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
            voice_response = await client.get(
                f"https://api.elevenlabs.io/v1/voices/{voice_id}",
                headers={"xi-api-key": elevenlabs_key},
            )
            voice_response.raise_for_status()
            voice_payload = voice_response.json()
            if voice_payload.get("voice_id") != voice_id:
                raise RuntimeError("ElevenLabs returned an unexpected voice identifier")

            vapi_headers = {"Authorization": f"Bearer {vapi_key}"}
            assistant_response = await client.get(
                f"https://api.vapi.ai/assistant/{assistant_id}",
                headers=vapi_headers,
            )
            assistant_response.raise_for_status()
            assistant = assistant_response.json()
            if assistant.get("id") != assistant_id:
                raise RuntimeError("Vapi returned an unexpected assistant identifier")

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

            server_messages = set(assistant.get("serverMessages") or [])
            server_messages.update(
                {
                    "assistant-request",
                    "tool-calls",
                    "status-update",
                    "end-of-call-report",
                    "transcript",
                }
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
                "serverMessages": sorted(server_messages),
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
            "Vapi assistant and ElevenLabs voice configuration verified.",
            data={
                "assistant_id": assistant_id,
                "voice_id": voice_id,
                "voice_model": voice_model,
                "webhook_url": webhook_url,
                "elevenlabs_voice_name": voice_payload.get("name"),
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
                        "status": "railway-native-certified",
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
            "Vapi, ElevenLabs, Railway routing, and Hermes persistence certified.",
            data={
                "assistant_id": assistant_id,
                "voice_id": voice_id,
                "voice_model": voice_model,
                "webhook_url": webhook_url,
                "certification_event_id": certification_event_id,
                "deployment_id": deployment_id,
            },
            correlation_id=correlation_id,
        )
        logger.info("Railway-native voice activation certified successfully.")
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
