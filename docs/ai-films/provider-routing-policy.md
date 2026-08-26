# AI Films Provider Routing Policy

## Goals

D3VONN AI Films should be provider-independent. Providers are interchangeable capacity, not architectural dependencies.

## Eligibility states

1. `discovered` — provider identified; no verification.
2. `verified` — workflow and public terms reviewed.
3. `api_ready` — authorized API/worker integration exists and secrets are server-side.
4. `production` — reliability, quality, licensing, watermark, security, and operational checks pass.

Only `production` providers may receive production jobs.

## Routing order

The router should filter by required capabilities first, then rank eligible providers by benchmark score, reliability, latency, and effective cost. A failed provider may be retried only within its configured circuit-breaker policy, then the job falls back to another eligible provider.

## Free-provider rule

A free or unlimited claim does not imply production eligibility. Browser-only services remain `manual_bridge` or `verified` until an authorized automation/API path is established. Do not use scraping or unauthorized browser automation as a production integration.

## Benchmark dimensions

Use identical test prompts/assets to score visual quality, temporal consistency, character consistency, prompt adherence, artifact rate, latency, reliability, licensing/commercial suitability, watermark behavior, and effective cost.

## Local-provider tier

The long-term architecture should support local GPU workers as another provider tier. This allows D3VONN to reduce external dependency while retaining premium API fallbacks.
