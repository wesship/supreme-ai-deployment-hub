"""Staging-only read-only Hermes owner-isolation certification.

Required: STAGING_SUPABASE_URL, STAGING_SUPABASE_ANON_KEY,
STAGING_API_URL, E2E_TEST_EMAIL, E2E_TEST_PASSWORD,
E2E_TEST_EMAIL_B, E2E_TEST_PASSWORD_B, HERMES_TEST_CORRELATION_ID_A.

The correlation ID must identify an existing, synthetic test task owned by account A.
Never run against production or print tokens.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from urllib.parse import urlsplit

import pytest


def _settings():
    keys = (
        "STAGING_SUPABASE_URL", "STAGING_SUPABASE_ANON_KEY",
        "STAGING_API_URL", "E2E_TEST_EMAIL", "E2E_TEST_PASSWORD",
        "E2E_TEST_EMAIL_B", "E2E_TEST_PASSWORD_B", "HERMES_TEST_CORRELATION_ID_A",
    )
    missing = [key for key in keys if not os.getenv(key)]
    if missing:
        pytest.fail("Staging certification blocked: missing " + ", ".join(missing), pytrace=False)
    supabase = os.environ["STAGING_SUPABASE_URL"].rstrip("/")
    api = os.environ["STAGING_API_URL"].rstrip("/")
    for value in (supabase, api):
        parsed = urlsplit(value)
        if parsed.scheme != "https" or not parsed.hostname:
            pytest.fail("Staging endpoints must use HTTPS", pytrace=False)
    if api.lower().startswith(("https://api.d3vonn.io", "https://d3vonn.io", "https://www.d3vonn.io")):
        pytest.fail("Production API is prohibited for this staging test", pytrace=False)
    if "staging" not in api.lower() and "preview" not in api.lower():
        pytest.fail("STAGING_API_URL must explicitly identify staging/preview", pytrace=False)
    if "tjygexesognbkwualywq" in supabase:
        pytest.fail("Production Supabase project is prohibited", pytrace=False)
    if os.environ["E2E_TEST_EMAIL"] == os.environ["E2E_TEST_EMAIL_B"]:
        pytest.fail("Two distinct test accounts are required", pytrace=False)
    return supabase, api


def _request(url: str, headers: dict[str, str], payload=None):
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=headers, method="POST" if body else "GET")
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            return response.status, response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8")


def _token(supabase: str, email: str, password: str) -> str:
    code, content = _request(
        supabase + "/auth/v1/token?grant_type=password",
        {"apikey": os.environ["STAGING_SUPABASE_ANON_KEY"], "Content-Type": "application/json"},
        {"email": email, "password": password},
    )
    if code != 200:
        pytest.fail("Staging test account authentication failed", pytrace=False)
    token = json.loads(content).get("access_token")
    if not token:
        pytest.fail("Staging authentication returned no token", pytrace=False)
    return token


def test_other_account_cannot_read_hermes_stream():
    supabase, api = _settings()
    token_a = _token(supabase, os.environ["E2E_TEST_EMAIL"], os.environ["E2E_TEST_PASSWORD"])
    token_b = _token(supabase, os.environ["E2E_TEST_EMAIL_B"], os.environ["E2E_TEST_PASSWORD_B"])
    correlation = os.environ["HERMES_TEST_CORRELATION_ID_A"]
    from urllib.parse import urlencode
    url = api + "/api/hermes/events/stream?" + urlencode({"correlation_id": correlation, "once": "true"})
    status_a, _ = _request(url, {"Authorization": "Bearer " + token_a, "Accept": "text/event-stream"})
    if status_a != 200:
        pytest.fail(f"Owner account cannot access its synthetic task stream (HTTP {status_a})", pytrace=False)
    status_b, content_b = _request(url, {"Authorization": "Bearer " + token_b, "Accept": "text/event-stream"})
    assert status_b in (403, 404), f"Cross-account stream returned HTTP {status_b}"
    assert "data: " not in content_b
