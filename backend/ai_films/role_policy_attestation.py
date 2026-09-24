"""Short-lived server attestation that an exact role draft passed policy checks.

This is not a render-quality or clinical-safety test. The authoring transaction
must verify this token against the persisted project/role/revision/profile.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any

from backend.ai_films.role_runtime import profile_hash, validate_profile


class InvalidAttestation(ValueError):
    pass


def _secret() -> bytes:
    value = os.getenv("AI_FILMS_ROLE_ATTESTATION_SECRET", "")
    if len(value) < 32:
        raise RuntimeError("Role attestation secret must be at least 32 characters")
    return value.encode("utf-8")


def _encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _decode(value: str) -> bytes:
    try:
        return base64.b64decode(value + "=" * (-len(value) % 4), altchars=b"-_", validate=True)
    except (ValueError, base64.binascii.Error) as exc:
        raise InvalidAttestation("Malformed attestation") from exc


def issue_policy_attestation(project_id: str, role_id: str, revision: int,
                             profile: dict[str, Any], *, at: int | None = None,
                             character_id: str | None = None) -> str:
    validate_profile(role_id, profile)
    if not project_id or type(revision) is not int or revision < 1:
        raise InvalidAttestation("Invalid draft identity")
    issued = int(time.time()) if at is None else at
    payload = {"project_id": project_id, "role_id": role_id, "revision": revision,
               "character_id": character_id,
               "profile_hash": profile_hash(profile), "test_type": "policy_v1",
               "iat": issued, "exp": issued + 600, "nonce": secrets.token_hex(16)}
    body = _encode(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode())
    signature = _encode(hmac.new(_secret(), body.encode("ascii"), hashlib.sha256).digest())
    return body + "." + signature


def verify_policy_attestation(token: str, project_id: str, role_id: str, revision: int,
                              profile: dict[str, Any], *, at: int | None = None,
                              character_id: str | None = None) -> dict[str, Any]:
    if not isinstance(token, str) or len(token) > 2048 or token.count(".") != 1:
        raise InvalidAttestation("Malformed attestation")
    body, signature = token.split(".")
    try:
        encoded_body = body.encode("ascii")
    except UnicodeEncodeError as exc:
        raise InvalidAttestation("Malformed attestation") from exc
    expected = hmac.new(_secret(), encoded_body, hashlib.sha256).digest()
    decoded_signature = _decode(signature)
    if _encode(decoded_signature) != signature or not hmac.compare_digest(decoded_signature, expected):
        raise InvalidAttestation("Invalid attestation signature")
    try:
        payload = json.loads(_decode(body))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise InvalidAttestation("Malformed attestation payload") from exc
    now = int(time.time()) if at is None else at
    if (not isinstance(payload, dict) or payload.get("test_type") != "policy_v1"
            or payload.get("project_id") != project_id or payload.get("role_id") != role_id
            or payload.get("character_id") != character_id
            or type(payload.get("revision")) is not int or payload["revision"] != revision
            or payload.get("profile_hash") != profile_hash(profile)
            or type(payload.get("iat")) is not int or type(payload.get("exp")) is not int
            or payload["iat"] > now + 30 or payload["exp"] < now or payload["exp"] - payload["iat"] != 600):
        raise InvalidAttestation("Attestation does not match the current draft")
    validate_profile(role_id, profile)
    return payload
