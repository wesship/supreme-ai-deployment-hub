#!/usr/bin/env python3
"""Activate and certify D3VONN voice services without exposing credentials."""
from __future__ import annotations

import json
import os
import secrets
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

PROJECT_ID = "65a00bf6-1a68-414e-bbe9-a30052595a83"
SERVICE_ID = "475dde82-373b-4c9f-9fd8-0ffb7a5dc2f0"
ENVIRONMENT = "production"
HEALTH_URL = "https://api.d3vonn.io/api/voice/health"
WEBHOOK_URL = "https://api.d3vonn.io/api/voice/vapi/webhook"
DEFAULT_ASSISTANT_ID = "8491eea7-e385-426b-8cdc-3e2aaf9a4cbf"
DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"
DEFAULT_VOICE_MODEL = "eleven_turbo_v2_5"


def first_env(*names: str, fallback: str = "") -> str:
    for name in names:
        value = os.getenv(name, "").strip()
        if value:
            return value
    return fallback


def require_real(name: str, value: str, minimum: int = 1) -> str:
    lowered = value.lower()
    invalid = ("paste_", "change_me", "your_", "placeholder", "<")
    if not value or len(value) < minimum or lowered.startswith(invalid) or value.endswith(">"):
        raise RuntimeError(f"MISSING_OR_PLACEHOLDER: {name}")
    if "\n" in value or "\r" in value:
        raise RuntimeError(f"INVALID_NEWLINE: {name}")
    return value


def request_json(
    url: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    payload: dict[str, Any] | None = None,
    timeout: int = 30,
) -> tuple[int, dict[str, Any]]:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=body, method=method)
    for key, value in (headers or {}).items():
        request.add_header(key, value)
    if payload is not None:
        request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            data = json.loads(raw) if raw else {}
            if not isinstance(data, dict):
                raise RuntimeError(f"Unexpected JSON response from {url}")
            return response.status, data
    except urllib.error.HTTPError as exc:
        safe_body = exc.read().decode("utf-8", errors="replace")[:1000]
        raise RuntimeError(f"HTTP_{exc.code} from {url}: {safe_body}") from exc


def run(*args: str, input_text: str | None = None, capture: bool = False) -> str:
    result = subprocess.run(
        list(args),
        input=input_text,
        text=True,
        check=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.STDOUT if capture else None,
    )
    return result.stdout or ""


def resolve_configuration() -> dict[str, str]:
    vapi_key = require_real(
        "VAPI_PRIVATE_KEY or VAPI_API_KEY",
        first_env("VAPI_PRIVATE_KEY", "VAPI_API_KEY"),
        12,
    )
    eleven_key = require_real("ELEVENLABS_API_KEY", first_env("ELEVENLABS_API_KEY"), 12)
    assistant_id = require_real(
        "VAPI_ASSISTANT_ID",
        first_env("VAPI_ASSISTANT_ID", fallback=DEFAULT_ASSISTANT_ID),
        12,
    )
    voice_id = require_real(
        "ELEVENLABS_DEFAULT_VOICE_ID",
        first_env("ELEVENLABS_DEFAULT_VOICE_ID", "ELEVENLABS_VOICE_ID", fallback=DEFAULT_VOICE_ID),
        8,
    )
    webhook_secret = require_real(
        "VAPI_WEBHOOK_SECRET",
        first_env("VAPI_WEBHOOK_SECRET", fallback=secrets.token_hex(32)),
        24,
    )

    railway_token = first_env("RAILWAY_TOKEN")
    railway_api_token = first_env("RAILWAY_API_TOKEN")
    if railway_token and railway_api_token:
        raise RuntimeError("Set only one of RAILWAY_TOKEN or RAILWAY_API_TOKEN")
    if not railway_token and not railway_api_token:
        raise RuntimeError("MISSING_OR_PLACEHOLDER: RAILWAY_TOKEN or RAILWAY_API_TOKEN")

    return {
        "VAPI_PRIVATE_KEY": vapi_key,
        "VAPI_ASSISTANT_ID": assistant_id,
        "VAPI_WEBHOOK_SECRET": webhook_secret,
        "ELEVENLABS_API_KEY": eleven_key,
        "ELEVENLABS_DEFAULT_VOICE_ID": voice_id,
        "ELEVENLABS_DEFAULT_MODEL": DEFAULT_VOICE_MODEL,
    }


def validate_providers(config: dict[str, str]) -> None:
    status, voice = request_json(
        f"https://api.elevenlabs.io/v1/voices/{config['ELEVENLABS_DEFAULT_VOICE_ID']}",
        headers={"xi-api-key": config["ELEVENLABS_API_KEY"]},
    )
    if status != 200 or voice.get("voice_id") != config["ELEVENLABS_DEFAULT_VOICE_ID"]:
        raise RuntimeError("ELEVENLABS_VALIDATION_FAILED")

    status, assistant = request_json(
        f"https://api.vapi.ai/assistant/{config['VAPI_ASSISTANT_ID']}",
        headers={"Authorization": f"Bearer {config['VAPI_PRIVATE_KEY']}"},
    )
    if status != 200 or assistant.get("id") != config["VAPI_ASSISTANT_ID"]:
        raise RuntimeError("VAPI_VALIDATION_FAILED")

    print(f"Validated ElevenLabs voice: {voice.get('name', 'configured voice')}")
    print("Validated the published Vapi assistant.")


def configure_railway(config: dict[str, str]) -> None:
    run(
        "railway",
        "link",
        "--project",
        PROJECT_ID,
        "--environment",
        ENVIRONMENT,
        "--service",
        SERVICE_ID,
        "--json",
    )
    status_text = run("railway", "status", "--json", capture=True)
    if PROJECT_ID not in status_text or SERVICE_ID not in status_text:
        raise RuntimeError("RAILWAY_LINK_MISMATCH")

    for key, value in config.items():
        run(
            "railway",
            "variable",
            "set",
            key,
            "--stdin",
            "--skip-deploys",
            "--service",
            SERVICE_ID,
            "--environment",
            ENVIRONMENT,
            input_text=value,
        )

    run(
        "railway",
        "redeploy",
        "--service",
        SERVICE_ID,
        "--environment",
        ENVIRONMENT,
        "--yes",
    )
    print("Synchronized voice variables and triggered Railway redeployment.")


def wait_for_health() -> dict[str, Any]:
    required = {
        "vapi_public_configuration",
        "vapi_private_key",
        "vapi_webhook_auth",
        "elevenlabs_api",
        "elevenlabs_voice",
        "hermes_internal_adapter",
    }
    last: dict[str, Any] = {}
    for _ in range(90):
        try:
            status, data = request_json(HEALTH_URL, timeout=20)
            last = data
            checks = data.get("checks") if isinstance(data.get("checks"), dict) else {}
            if status == 200 and data.get("status") == "configured" and all(checks.get(key) is True for key in required):
                print("The live Railway voice backend reports fully configured.")
                return data
        except Exception as exc:  # deployment may be temporarily unavailable
            last = {"transient_error": str(exc)}
        time.sleep(5)
    raise RuntimeError(f"VOICE_HEALTH_TIMEOUT: {last}")


def configure_vapi(config: dict[str, str]) -> None:
    url = f"https://api.vapi.ai/assistant/{config['VAPI_ASSISTANT_ID']}"
    headers = {"Authorization": f"Bearer {config['VAPI_PRIVATE_KEY']}"}
    _, assistant = request_json(url, headers=headers)

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
    voice = {key: value for key, value in current_voice.items() if key in allowed_voice_fields}
    voice.update(
        {
            "provider": "11labs",
            "voiceId": config["ELEVENLABS_DEFAULT_VOICE_ID"],
            "model": config["ELEVENLABS_DEFAULT_MODEL"],
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
    patch = {
        "server": {
            "url": WEBHOOK_URL,
            "secret": config["VAPI_WEBHOOK_SECRET"],
            "timeoutSeconds": 20,
        },
        "serverMessages": sorted(server_messages),
        "voice": voice,
    }
    status, updated = request_json(url, method="PATCH", headers=headers, payload=patch)
    if status != 200:
        raise RuntimeError("VAPI_PATCH_FAILED")

    server = updated.get("server") if isinstance(updated.get("server"), dict) else {}
    updated_voice = updated.get("voice") if isinstance(updated.get("voice"), dict) else {}
    if server.get("url") != WEBHOOK_URL:
        raise RuntimeError("VAPI_WEBHOOK_NOT_PERSISTED")
    if updated_voice.get("provider") != "11labs":
        raise RuntimeError("VAPI_ELEVENLABS_PROVIDER_NOT_PERSISTED")
    if updated_voice.get("voiceId") != config["ELEVENLABS_DEFAULT_VOICE_ID"]:
        raise RuntimeError("VAPI_ELEVENLABS_VOICE_NOT_PERSISTED")
    print("Configured and verified the Vapi webhook and ElevenLabs voice.")


def certify_webhook(config: dict[str, str]) -> None:
    event_id = f"final-voice-cert-{os.getenv('GITHUB_RUN_ID', 'manual')}-{os.getenv('GITHUB_RUN_ATTEMPT', '1')}"
    status, result = request_json(
        WEBHOOK_URL,
        method="POST",
        headers={"x-vapi-secret": config["VAPI_WEBHOOK_SECRET"]},
        payload={
            "message": {
                "id": event_id,
                "type": "status-update",
                "status": "final-production-certified",
            }
        },
    )
    if status != 200 or result.get("ok") is not True or result.get("event_id") != event_id:
        raise RuntimeError(f"WEBHOOK_CERTIFICATION_FAILED: {result}")
    if result.get("hermes_recorded") is not True:
        raise RuntimeError(f"HERMES_PERSISTENCE_FAILED: {result}")
    print("Certified Vapi authentication, Railway routing, and Hermes persistence end to end.")


def main() -> int:
    try:
        config = resolve_configuration()
        validate_providers(config)
        configure_railway(config)
        wait_for_health()
        configure_vapi(config)
        certify_webhook(config)
        Path("voice-activation-result.json").write_text(
            json.dumps(
                {
                    "status": "certified",
                    "assistant_id": config["VAPI_ASSISTANT_ID"],
                    "webhook_url": WEBHOOK_URL,
                    "railway_project_id": PROJECT_ID,
                    "railway_service_id": SERVICE_ID,
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        return 0
    except Exception as exc:
        print(f"VOICE_ACTIVATION_FAILED: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
