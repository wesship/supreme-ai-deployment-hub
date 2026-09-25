"""Short-lived authenticated session tokens for inline Vapi web calls."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from uuid import UUID
from typing import Any

_AUDIENCE = "d3vonn-voice-webhook"
_DEFAULT_TTL_SECONDS = 7_200
_MAX_TTL_SECONDS = 10_800


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _signing_secret() -> str:
    """Resolve secret entropy already present on the trusted backend."""
    for name in (
        "VOICE_SESSION_SIGNING_SECRET",
        "VAPI_WEBHOOK_SECRET",
        "VAPI_PRIVATE_KEY",
        "VAPI_API_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "JWT_SECRET",
    ):
        value = os.getenv(name, "").strip()
        if value and not value.lower().startswith(("paste_", "change_me", "your_", "placeholder")):
            return value
    return ""


def _character_binding(binding: dict[str, Any]) -> dict[str, Any]:
    """Validate the exact immutable release identity carried by a preview token."""
    required = {"project_id", "character_id", "role_id", "version", "profile_hash"}
    if not isinstance(binding, dict) or set(binding) != required:
        raise ValueError("Invalid character voice binding")
    try:
        for key in ("project_id", "character_id"):
            if str(UUID(binding[key])) != binding[key]:
                raise ValueError("Noncanonical identity")
    except (ValueError, TypeError, AttributeError) as exc:
        raise ValueError("Invalid character voice identity") from exc
    if (binding["role_id"] not in {"teacher", "instructor", "radio_dj", "host", "support"}
            or type(binding["version"]) is not int or binding["version"] < 1
            or not isinstance(binding["profile_hash"], str)
            or len(binding["profile_hash"]) != 64
            or any(ch not in "0123456789abcdef" for ch in binding["profile_hash"])):
        raise ValueError("Invalid character voice release")
    return dict(binding)


def issue_voice_session(user_id: str, ttl_seconds: int = _DEFAULT_TTL_SECONDS,
                        *, character_binding: dict[str, Any] | None = None) -> tuple[str, int]:
    """Issue an HMAC-signed token scoped to one authenticated D3VONN user."""
    secret = _signing_secret()
    if not secret:
        raise RuntimeError("Voice session signing is not configured")

    now = int(time.time())
    ttl = max(300, min(int(ttl_seconds), 600 if character_binding is not None else _MAX_TTL_SECONDS))
    expires_at = now + ttl
    payload = {
        "aud": _AUDIENCE,
        "sub": user_id,
        "iat": now,
        "exp": expires_at,
        "jti": secrets.token_urlsafe(18),
    }
    if character_binding is not None:
        payload["scope"] = "character-preview"
        payload["character"] = _character_binding(character_binding)
    encoded_payload = _b64encode(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    signature = hmac.new(secret.encode("utf-8"), encoded_payload.encode("ascii"), hashlib.sha256).digest()
    return f"{encoded_payload}.{_b64encode(signature)}", expires_at


def verify_voice_session(token: str | None) -> dict[str, Any] | None:
    """Verify a call-scoped token without raising or exposing validation details."""
    if not token or len(token) > 2_048:
        return None
    secret = _signing_secret()
    if not secret:
        return None

    try:
        encoded_payload, encoded_signature = token.split(".", 1)
        supplied_signature = _b64decode(encoded_signature)
        # Reject non-canonical base64url encodings with ignored padding bits.
        # Otherwise distinct token strings can represent the same valid signature.
        if not hmac.compare_digest(_b64encode(supplied_signature), encoded_signature):
            return None
        expected_signature = hmac.new(
            secret.encode("utf-8"), encoded_payload.encode("ascii"), hashlib.sha256
        ).digest()
        if not hmac.compare_digest(supplied_signature, expected_signature):
            return None

        payload = json.loads(_b64decode(encoded_payload).decode("utf-8"))
        if not isinstance(payload, dict):
            return None
        now = int(time.time())
        if payload.get("aud") != _AUDIENCE:
            return None
        if not isinstance(payload.get("sub"), str) or not payload["sub"]:
            return None
        if not isinstance(payload.get("exp"), int) or payload["exp"] < now:
            return None
        if not isinstance(payload.get("iat"), int) or payload["iat"] > now + 60:
            return None
        if payload["exp"] - payload["iat"] > _MAX_TTL_SECONDS:
            return None
        if payload.get("scope") == "character-preview":
            if _character_binding(payload.get("character")) != payload["character"]:
                return None
            if payload["exp"] - payload["iat"] > 600:
                return None
        elif "scope" in payload or "character" in payload:
            return None
        return payload
    except (ValueError, TypeError, json.JSONDecodeError, UnicodeDecodeError):
        return None
