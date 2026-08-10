# AI Films Commerce Studio

Commerce Studio adds product-focused campaign planning and Pollo generation to the existing AI Films production system.

## Delivered workflow

1. Enter a product brief, audience, selling points, offer, and brand voice.
2. Choose ad formats: UGC, money shot, virtual try-on, TVC, problem/solution, before/after, unboxing, tutorial, or feature highlights.
3. Choose TikTok, Instagram Reels, Meta Feed, YouTube Shorts, YouTube, or Connected TV.
4. Build a deterministic, credit-safe campaign plan.
5. Dispatch approved prompts to Pollo 2.5.
6. Retrieve the authoritative Pollo task result after the signed completion webhook.
7. Persist generated media through the durable TwelveLabs/Jockey handoff worker.

The workspace is available at `/ai-films/commerce`.

## Server configuration

Set secrets only in the backend deployment environment:

```dotenv
POLLO_API_KEY=
POLLO_API_BASE_URL=https://pollo.ai/api/platform
POLLO_WEBHOOK_URL=https://api.d3vonn.io/api/ai-films/commerce/providers/pollo/webhook
POLLO_WEBHOOK_SECRET=
AI_FILM_COMMERCE_HANDOFF_ENABLED=true
AI_FILM_COMMERCE_HANDOFF_POLL_SECONDS=15
AI_FILM_COMMERCE_HANDOFF_STALE_SECONDS=1800
AI_FILM_COMMERCE_HANDOFF_MAX_ATTEMPTS=5
```

Do not add these values to Vite/client environment variables.

## API

- `GET /api/ai-films/commerce/templates`
- `POST /api/ai-films/commerce/campaigns/plan`
- `POST /api/ai-films/commerce/providers/pollo/dispatch`
- `POST /api/ai-films/commerce/providers/pollo/webhook`

Planning and dispatch require a valid Supabase bearer token. Planning never calls a generation provider and never spends credits. Dispatch returns `202` with the Pollo task ID. The completion webhook is deliberately acknowledged without doing long-running media ingestion. A Railway worker claims the persisted handoff, retrieves `/generation/{taskId}/status`, requires HTTPS media URLs, uploads them to TwelveLabs, and creates Jockey knowledge-store items. Partial results are persisted so a restarted worker resumes completed media instead of replaying the entire handoff.

Pollo webhook notifications are authenticated with HMAC-SHA-256 using the Base64 webhook secret and the `X-Webhook-Id`, `X-Webhook-Timestamp`, and `X-Webhook-Signature` headers.

## Production acceptance

- Run `pytest backend/tests/test_ai_films_commerce.py`.
- Run frontend typecheck, tests, and build.
- Confirm provider health lists `video/pollo`, `commerce_generation/pollo`, `virtual_try_on/pollo`, and `product_image/pollo`.
- Open Commerce Studio while authenticated and create a plan.
- Confirm no Pollo task is created during planning.
- Configure Pollo secrets in staging.
- Dispatch one four-second 720p test and confirm the signed webhook.
- Confirm `ai_films_commerce_handoff` reports `running` in `/health/deployment`.
- Confirm the job transitions `queued -> processing -> completed` for `handoff_status`.
- Confirm the completed row records TwelveLabs asset/item IDs and the configured Jockey knowledge-store ID.
