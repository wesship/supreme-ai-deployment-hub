"""Canonical JSON serialization and HMAC signing for Hermes webhooks."""
from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any


def canonical_json(payload: dict[str, Any]) -> str:
    """Serialize a payload exactly once for signing and transmission."""
    return json.dumps(payload, separators=(",", ":"), sort_keys=True)


def sign_payload(body: str, secret: str) -> str:
    """Return a lowercase HMAC-SHA256 hexadecimal signature."""
    if not secret:
        raise ValueError("HMAC secret must not be empty")
    return hmac.new(secret.encode("utf-8"), body.encode("utf-8"), hashlib.sha256).hexdigest()
