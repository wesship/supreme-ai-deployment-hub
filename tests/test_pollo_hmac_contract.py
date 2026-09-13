import base64
import hashlib
import hmac

from backend.ai_films.commerce_router import _signature_candidates


def _sign(secret_b64: str, webhook_id: str, timestamp: str, body: bytes) -> str:
    key = base64.b64decode(secret_b64, validate=True)
    signed = webhook_id.encode() + b"." + timestamp.encode() + b"." + body
    return base64.b64encode(hmac.new(key, signed, hashlib.sha256).digest()).decode()


def test_pollo_hmac_contract_accepts_valid_signature_and_rejects_invalid():
    secret_b64 = base64.b64encode(b"gate-2e6-test-secret").decode()
    webhook_id = "gate-2e6-test"
    timestamp = "1789335000"
    body = b'{"event":"synthetic","status":"non_destructive"}'

    expected = _sign(secret_b64, webhook_id, timestamp, body)

    assert any(hmac.compare_digest(candidate, expected) for candidate in _signature_candidates(expected))
    assert any(hmac.compare_digest(candidate, expected) for candidate in _signature_candidates(f"v1,{expected}"))
    assert not any(hmac.compare_digest(candidate, expected) for candidate in _signature_candidates("invalid-signature"))
