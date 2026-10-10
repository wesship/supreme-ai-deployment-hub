#!/usr/bin/env python3
"""
scripts/smoke_test.py — Devonn.AI Phase 4 Smoke Test

Verifies the live API is healthy and the auth gate is enforced.

Usage:
    python3 scripts/smoke_test.py [API_BASE_URL]

Examples:
    python3 scripts/smoke_test.py
    python3 scripts/smoke_test.py http://localhost:8000

Exit codes:
    0 — all checks passed
    1 — one or more checks failed
"""
from __future__ import annotations

import json
import sys
import urllib.request
import urllib.error
from dataclasses import dataclass, field
from typing import Optional

API = sys.argv[1] if len(sys.argv) > 1 else "https://api.d3vonn.io"
TIMEOUT = 12

# ── Helpers ───────────────────────────────────────────────────────────────────

def _get(path: str, headers: Optional[dict] = None) -> tuple[int, str]:
    url = f"{API}{path}"
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
    except Exception as e:
        return 0, str(e)


def _post(path: str, body: dict, headers: Optional[dict] = None) -> tuple[int, str]:
    url = f"{API}{path}"
    data = json.dumps(body).encode()
    h = {"Content-Type": "application/json", **(headers or {})}
    req = urllib.request.Request(url, data=data, headers=h, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
    except Exception as e:
        return 0, str(e)


# ── Result tracking ───────────────────────────────────────────────────────────

@dataclass
class Results:
    passed: list[str] = field(default_factory=list)
    failed: list[str] = field(default_factory=list)
    warned: list[str] = field(default_factory=list)

    def ok(self, msg: str)   -> None: self.passed.append(msg); print(f"  \033[32m✓\033[0m {msg}")
    def fail(self, msg: str) -> None: self.failed.append(msg); print(f"  \033[31m✗\033[0m {msg}")
    def warn(self, msg: str) -> None: self.warned.append(msg); print(f"  \033[33m!\033[0m {msg}")


r = Results()

print()
print("╔══════════════════════════════════════════════════════╗")
print("║          Devonn.AI API Smoke Test — Phase 4          ║")
print("╚══════════════════════════════════════════════════════╝")
print(f"  Target: {API}")
print()

# ── 1. Liveness ───────────────────────────────────────────────────────────────
print("[ 1 ] Liveness — GET /health")
status, body = _get("/health")
if status == 200:
    r.ok(f"GET /health → 200")
else:
    r.fail(f"GET /health → {status} (expected 200)")

# ── 2. Readiness ──────────────────────────────────────────────────────────────
print("[ 2 ] Readiness — GET /ready")
status, body = _get("/ready")
if status == 200:
    r.ok(f"GET /ready → 200")
else:
    r.fail(f"GET /ready → {status} (expected 200)")

# ── 3. Deep health with proxy_vault block ────────────────────────────────────
print("[ 3 ] Deep health — GET /health/deep")
status, body = _get("/health/deep")
try:
    data = json.loads(body)
    if data.get("status") == "ok":
        r.ok("GET /health/deep → status:ok")
    else:
        r.fail(f"GET /health/deep → unexpected status: {data.get('status')}")
    if "proxy_vault" in data:
        pv = data["proxy_vault"]
        r.ok(f"GET /health/deep → proxy_vault block present: {pv}")
    else:
        r.warn("GET /health/deep → proxy_vault block missing (deploy may be pending)")
except Exception:
    r.fail(f"GET /health/deep → non-JSON body: {body[:120]}")

# ── 4. Auth gate on proxy config ─────────────────────────────────────────────
print("[ 4 ] Auth gate — GET /api/proxy/config (no token)")
status, body = _get("/api/proxy/config")
if status == 401:
    r.ok("GET /api/proxy/config (no token) → 401 Unauthorized")
elif status == 404:
    r.fail("GET /api/proxy/config → 404 (router not registered — deploy pending)")
else:
    r.fail(f"GET /api/proxy/config → {status} (expected 401)")

# ── 5. Auth gate on vault keys ────────────────────────────────────────────────
print("[ 5 ] Auth gate — GET /api/proxy/vault/keys (no token)")
status, body = _get("/api/proxy/vault/keys")
if status == 401:
    r.ok("GET /api/proxy/vault/keys (no token) → 401 Unauthorized")
elif status == 404:
    r.fail("GET /api/proxy/vault/keys → 404 (router not registered — deploy pending)")
else:
    r.fail(f"GET /api/proxy/vault/keys → {status} (expected 401)")

# ── 6. Auth gate on vault POST ────────────────────────────────────────────────
print("[ 6 ] Auth gate — POST /api/proxy/vault/keys (no token)")
status, body = _post("/api/proxy/vault/keys", {"name": "FAKE_KEY", "value": "sk-fake"})
if status == 401:
    r.ok("POST /api/proxy/vault/keys (no token) → 401 Unauthorized")
elif status == 404:
    r.fail("POST /api/proxy/vault/keys → 404 (router not registered — deploy pending)")
else:
    r.fail(f"POST /api/proxy/vault/keys → {status} (expected 401)")

# ── 7. OpenAPI spec sanity ────────────────────────────────────────────────────
print("[ 7 ] OpenAPI spec — GET /api/openapi.json")
status, body = _get("/api/openapi.json")
try:
    spec = json.loads(body)
    proxy_routes = [p for p in spec.get("paths", {}) if "/proxy" in p]
    n = len(proxy_routes)
    if n >= 3:
        r.ok(f"OpenAPI spec contains {n} /api/proxy routes: {proxy_routes}")
    elif n >= 1:
        r.warn(f"OpenAPI spec contains only {n} /api/proxy routes (expected ≥3)")
    else:
        r.fail("OpenAPI spec contains no /api/proxy routes (deploy pending or router missing)")
except Exception:
    r.fail(f"OpenAPI spec → non-JSON body: {body[:80]}")

# ── Summary ───────────────────────────────────────────────────────────────────
print()
print("──────────────────────────────────────────────────────")
print(f"  \033[32mPassed:\033[0m   {len(r.passed)}")
print(f"  \033[33mWarnings:\033[0m {len(r.warned)}")
print(f"  \033[31mFailed:\033[0m   {len(r.failed)}")
print("──────────────────────────────────────────────────────")
print()

if r.failed:
    print(f"\033[31mSMOKE TEST FAILED — {len(r.failed)} check(s) did not pass.\033[0m")
    for f in r.failed:
        print(f"  ✗ {f}")
    sys.exit(1)
else:
    print("\033[32mSMOKE TEST PASSED\033[0m")
    sys.exit(0)
