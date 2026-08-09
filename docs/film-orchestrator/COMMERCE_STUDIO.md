# AI Films Commerce Studio

Commerce Studio adds product-focused campaign planning and Pollo generation to the existing AI Films production system.

## Delivered workflow

1. Enter a product brief, audience, selling points, offer, and brand voice.
2. Choose ad formats: UGC, money shot, virtual try-on, TVC, problem/solution, before/after, unboxing, tutorial, or feature highlights.
3. Choose TikTok, Instagram Reels, Meta Feed, YouTube Shorts, YouTube, or Connected TV.
4. Build a deterministic, credit-safe campaign plan.
5. Dispatch approved prompts to Pollo 2.5.
6. Send completed output through the existing AI Films ingestion and TwelveLabs/Jockey indexing path.

The workspace is available at `/ai-films/commerce`.

## Server configuration

Set secrets only in the backend deployment environment:

```dotenv
POLLO_API_KEY=
POLLO_API_BASE_URL=https://pollo.ai/api/platform
POLLO_WEBHOOK_URL=https://api.d3vonn.io/api/ai-films/commerce/providers/pollo/webhook
POLLO_WEBHOOK_SECRET=
```

Do not add these values to Vite/client environment variables.

## API

- `GET /api/ai-films/commerce/templates`
- `POST /api/ai-films/commerce/campaigns/plan`
- `POST /api/ai-films/commerce/providers/pollo/dispatch`
- `POST /api/ai-films/commerce/providers/pollo/webhook`

Planning and dispatch require a valid Supabase bearer token. Planning never calls a generation provider and never spends credits. Dispatch returns `202` with the Pollo task ID.

Pollo webhook notifications are authenticated with HMAC-SHA-256 using the Base64 webhook secret and the `X-Webhook-Id`, `X-Webhook-Timestamp`, and `X-Webhook-Signature` headers.

## Production acceptance

- Run `pytest backend/tests/test_ai_films_commerce.py`.
- Run frontend typecheck, tests, and build.
- Confirm provider health lists `video/pollo`, `commerce_generation/pollo`, `virtual_try_on/pollo`, and `product_image/pollo`.
- Open Commerce Studio while authenticated and create a plan.
- Confirm no Pollo task is created during planning.
- Configure Pollo secrets in staging.
- Dispatch one four-second 720p test and confirm the signed webhook.
- Ingest the completed media asset into the existing Jockey/TwelveLabs pipeline.
