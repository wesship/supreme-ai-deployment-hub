# GATES.md

## Purpose

This document defines the required production gates for DEVONN.AI and the evidence required to mark each gate GREEN.

## Gate Discipline

Never mark a gate GREEN without live proof.

No assumed success. No theoretical pass. No downstream approval without evidence.

## Required Shipping Gates

### DNS

Required proof:
- Route 53 hosted zone NS records are known.
- Registrar nameservers match the Route 53 NS records.
- `api.devonn.ai` resolves publicly.

Accepted evidence:
- DNS lookup output
- Route 53 screenshot or exported record data
- Registrar nameserver screenshot

### Health

Required proof:
- `curl https://api.devonn.ai/health` returns HTTP 200 OK.

Accepted evidence:
- curl output
- CI health check log
- deployment verification artifact

### CI

Required proof:
- Required GitHub Actions checks pass on the exact target commit.

Accepted evidence:
- GitHub Actions run URL
- green required checks
- commit SHA tied to passing checks

### Sentry

Required proof:
- No new production error spike after deployment.
- If an intentional test error is used, it appears in the correct Sentry project.

Accepted evidence:
- Sentry issue link
- Sentry release health screenshot
- verification note with timestamp

### Bundle

Required proof:
- Frontend production bundle remains below the target budget of 900KB gzip.

Accepted evidence:
- build output
- bundle analyzer result
- CI artifact

### HMAC

Required proof:
- Protected routes reject unsigned traffic.
- Protected routes accept valid HMAC signatures.

Accepted evidence:
- test output
- curl output
- security verification log

### HITL

Required proof:
- Human approval exists before destructive action.

Accepted evidence:
- Hermes approval record
- Telegram approval log
- operator approval note

## Gate States

UNKNOWN: No evidence collected.
RED: Evidence shows failure.
YELLOW: Partial or stale evidence.
GREEN: Current evidence proves success.

## Shipping Rule

`/release` and `/ship` are blocked unless all required gates are GREEN with evidence.

## Private Beta Rule

Private beta approval is blocked until DNS and Health gates are GREEN.
