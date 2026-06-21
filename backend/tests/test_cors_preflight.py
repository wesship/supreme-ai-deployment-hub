"""
CORS preflight regression test for /api/chat.

Verifies the configuration in backend/main.py:
  - static allow-list origins return 200 with matching Access-Control-Allow-Origin
  - Lovable preview / Vercel preview URLs match `allow_origin_regex`
  - unrelated origins are rejected (no Access-Control-Allow-Origin header)

This guards against future regressions of the bug where lovable.app preview
URLs got 400 on preflight because they were not in the allow-list.
"""
from __future__ import annotations

import importlib
import os
import sys

import pytest
from fastapi.testclient import TestClient

# Ensure repo root is importable so `backend.main` resolves.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))


def _load_app():
    # Reload so env-var changes in the test session take effect on ALLOWED_ORIGINS.
    if "backend.main" in sys.modules:
        return importlib.reload(sys.modules["backend.main"]).app
    return importlib.import_module("backend.main").app


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(_load_app())


# Origins that MUST be allowed (static allow-list in backend/main.py)
ALLOWED_STATIC_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://d3vonn.io",
    "https://www.d3vonn.io",
    "https://app.d3vonn.io",
    "https://supreme-ai-deployment-hub.vercel.app",
    "https://supreme-ai-deployment-hub.lovable.app",
]

# Origins that MUST be allowed via `allow_origin_regex`
ALLOWED_REGEX_ORIGINS = [
    "https://id-preview--b5eb8a4d-3709-4e3f-930c-ab5ab4b96560.lovable.app",
    "https://feature-branch-preview.lovable.app",
    "https://something.lovableproject.com",
    "https://supreme-ai-deployment-hub-git-main-acme.vercel.app",
]

# Origins that MUST NOT be allowed
DISALLOWED_ORIGINS = [
    "https://evil.example.com",
    "http://d3vonn.io.attacker.com",
    "https://lovable.app.evil.com",
]


def _preflight(client: TestClient, origin: str):
    return client.options(
        "/api/chat",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,authorization",
        },
    )


@pytest.mark.parametrize("origin", ALLOWED_STATIC_ORIGINS + ALLOWED_REGEX_ORIGINS)
def test_preflight_allows_origin(client: TestClient, origin: str):
    r = _preflight(client, origin)
    assert r.status_code == 200, (
        f"Expected 200 preflight for {origin!r}, got {r.status_code}. "
        f"Body: {r.text[:200]}"
    )
    allow_origin = r.headers.get("access-control-allow-origin")
    assert allow_origin == origin, (
        f"Expected Access-Control-Allow-Origin={origin!r}, got {allow_origin!r}"
    )
    # POST must be advertised as an allowed method.
    allow_methods = (r.headers.get("access-control-allow-methods") or "").upper()
    assert "POST" in allow_methods or allow_methods == "*", (
        f"Expected POST in Access-Control-Allow-Methods, got {allow_methods!r}"
    )


@pytest.mark.parametrize("origin", DISALLOWED_ORIGINS)
def test_preflight_rejects_unknown_origin(client: TestClient, origin: str):
    r = _preflight(client, origin)
    # Starlette returns 400 for disallowed preflights, but the contract we
    # actually care about is: NO allow-origin header is echoed back.
    allow_origin = r.headers.get("access-control-allow-origin")
    assert allow_origin != origin, (
        f"Origin {origin!r} should not be allowed but server echoed it back"
    )
