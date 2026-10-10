"""Fail-closed device-envelope verification for the smart-glasses edge gateway."""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Callable, Mapping


@dataclass(frozen=True)
class VerifiedDeviceRequest:
    device_id: str
    timestamp: int
    nonce: str
    payload: Mapping[str, object]


def canonical_message(device_id: str, timestamp: int, nonce: str, payload: Mapping[str, object]) -> bytes:
    body = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return f"{device_id}\n{timestamp}\n{nonce}\n{body}".encode("utf-8")


def sign_request(secret: bytes, device_id: str, timestamp: int, nonce: str, payload: Mapping[str, object]) -> str:
    return hmac.new(secret, canonical_message(device_id, timestamp, nonce, payload), hashlib.sha256).hexdigest()


def verify_request(
    *,
    secret: bytes,
    device_id: str,
    timestamp: int,
    nonce: str,
    payload: Mapping[str, object],
    signature: str,
    nonce_seen: Callable[[str, str], bool],
    mark_nonce: Callable[[str, str, int], None],
    now: int | None = None,
    max_clock_skew_seconds: int = 60,
) -> VerifiedDeviceRequest:
    """Verify identity, freshness, integrity, and replay resistance before routing.

    `nonce_seen` and `mark_nonce` are intentionally injected so production can use
    Redis or another authoritative server-side store. This module never executes a
    device action and never grants GUARDIAN approval.
    """
    if not secret or not device_id or not nonce or not signature:
        raise PermissionError("missing_device_authentication")
    if max_clock_skew_seconds <= 0:
        raise ValueError("max_clock_skew_seconds must be positive")
    current = int(time.time()) if now is None else int(now)
    if abs(current - int(timestamp)) > max_clock_skew_seconds:
        raise PermissionError("stale_device_request")
    if nonce_seen(device_id, nonce):
        raise PermissionError("replayed_device_request")
    expected = sign_request(secret, device_id, int(timestamp), nonce, payload)
    if not hmac.compare_digest(expected, signature.lower()):
        raise PermissionError("invalid_device_signature")
    mark_nonce(device_id, nonce, int(timestamp))
    return VerifiedDeviceRequest(device_id=device_id, timestamp=int(timestamp), nonce=nonce, payload=payload)
