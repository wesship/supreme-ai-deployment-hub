# D3VONN Smart-Glasses / Needle edge gate

This package is an isolated, fail-closed smart-glasses control-plane candidate. Needle may propose a tool, but this code does not execute camera/device actions, call privileged D3VONN mutations, or grant GUARDIAN approval.

## Current safety boundary

`router.py` separates proposals into four routes:

- `local` — low-risk device candidates only; no adapter is enabled here.
- `d3vonn_gateway` — reasoning/vision/memory candidates; requires the authenticated D3VONN gateway.
- `guardian_review` — privileged requests such as deletion or money movement; human approval remains mandatory.
- `escalate` — malformed, ambiguous, negated, unknown, ungrounded, or low-confidence requests.

`security.py` defines the device identity envelope required before any proposal can reach an authoritative gateway. Production must provide a per-device secret or stronger hardware-backed identity, a server-side nonce store, revocation, and audit logging. Requests are HMAC-SHA256 signed over device ID, timestamp, nonce, and canonical payload; stale, replayed, or tampered requests fail closed.

## Production gates

1. **SG-1 — reconcile and certify Needle:** policy tests and acceptance suite, zero unsafe dispatches.
2. **SG-2 — authenticated gateway:** device registry, key rotation/revocation, Redis nonce persistence, GUARDIAN approval contract, audit correlation.
3. **SG-3 — Jetson Orin Nano runtime:** run real glasses transcripts, measure p50/p95 latency, intent accuracy, false dispatch rate, escalation rate, thermal/resource behavior, and offline recovery.
4. **SG-4 — controlled canary:** adapters remain deny-by-default; enable a small low-risk tool allowlist behind a kill switch, observe, and prove rollback before expansion.

## Local verification

Run policy tests from repository root:

```bash
python -m unittest discover -s edge/needle/tests
```

With `cactus-needle` installed and its model cached, run:

```bash
python -m edge.needle.evaluate
```

The frozen acceptance suite requires at least 90% intent correctness and zero critical unsafe dispatches. Previous x86_64 validation with `cactus-needle==2.0.13` produced 15/16 correct with zero unsafe dispatches; that is not evidence for live audio or Jetson hardware.

## Explicit non-goals in this gate

- no production device adapter
- no raw camera/media persistence contract
- no autonomous money movement or deletion
- no direct browser-to-device control
- no bypass of Hermes/GUARDIAN governance
- no claim of production readiness until SG-3 and SG-4 evidence exists
