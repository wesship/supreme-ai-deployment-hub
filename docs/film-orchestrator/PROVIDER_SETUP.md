# Provider setup

Configure provider secrets only in the Railway/VPS backend or protected Supabase Edge Function environment.

```env
XAI_API_KEY=
HIGGSFIELD_API_KEY=
RUNWAY_API_KEY=
LUMA_API_KEY=
KLING_ACCESS_KEY=
KLING_SECRET_KEY=
KLING_API_BASE_URL=https://api-singapore.klingai.com
AI_FILM_KLING_VIDEO_MODEL=kling-v3
AI_FILM_KLING_IMAGE_MODEL=kling-v3

# InVideo direct API access, when enabled for the account.
# InVideo MCP/OAuth can remain a manual or agent bridge until a server API key is issued.
INVIDEO_API_KEY=
INVIDEO_API_BASE_URL=
INVIDEO_MCP_URL=
AI_FILM_INVIDEO_VIDEO_MODEL=

ELEVENLABS_API_KEY=
TWELVELABS_API_KEY=
TWELVELABS_KNOWLEDGE_STORE_ID=
TWELVELABS_API_BASE_URL=https://api.twelvelabs.io/v1.3
```

Never expose these values through `VITE_*`, browser storage, React source, public tables, logs, or API responses.

## Initial activation sequence

1. Enable `mock` and validate the complete job lifecycle.
2. Add `XAI_API_KEY` and validate Grok image/video generation.
3. Add `ELEVENLABS_API_KEY` and validate narration/voice jobs.
4. Verify Higgsfield API access for the authenticated account; use a manual export/import bridge until direct API access is confirmed.
5. Add Runway and Luma as fallback providers.
6. Add the TwelveLabs API key and AI Film knowledge-store ID, then validate `GET /ai-films/intelligence/twelvelabs/status`.
7. Use `POST /ai-films/intelligence/twelvelabs/search` for ranked clip retrieval and `POST /ai-films/intelligence/twelvelabs/reason` for Jockey corpus reasoning/continuity review.

The TwelveLabs routes require a valid Supabase bearer token before D3VONN sends a provider request. Jockey is currently a TwelveLabs research-preview API, so keep the adapter isolated and revalidate the v1.3 contract before a future major-version upgrade.

## Required production controls

- Per-user authorization and RLS
- Credit and cost limits before submission
- Rate limiting per provider and user
- Request/response redaction
- Signed asset URLs
- Retry policy with idempotency keys
- Provider timeout and circuit breaker
- Human approval before timeline placement

## Add future image or video providers without a code change

Set `AI_FILM_CUSTOM_PROVIDERS_JSON` in the protected Railway/VPS environment. Do not place credentials or this registry in a `VITE_*` variable.

```json
[
  {
    "capability": "video",
    "provider": "studio_x",
    "required_env": ["STUDIO_X_API_KEY"],
    "optional_env": ["STUDIO_X_API_BASE_URL"],
    "model_env": "AI_FILM_STUDIO_X_VIDEO_MODEL"
  },
  {
    "capability": "image",
    "provider": "image_lab",
    "required_env": ["IMAGE_LAB_API_KEY"],
    "model_env": "AI_FILM_IMAGE_LAB_MODEL"
  }
]
```

The registry is additive and cannot override a built-in provider/capability pair. Every custom provider must declare a server-side credential or binary contract. The provider health endpoint reports only configuration state and variable names; it never returns secret values.

## Provider output to Jockey

All providers use the same ingestion envelope. A generator or manual export bridge produces a manifest entry like:

```json
{
  "source_type": "kling",
  "provider": "kling",
  "source_id": "provider-task-id",
  "ingestion_method": "url",
  "source_filename": "SS_01_03_004_v1.mp4",
  "media_url": "https://provider.example/signed-or-public-media.mp4",
  "asset_type": "video",
  "project_id": "b2979e7c-1d28-4024-bf4f-8db90c174d5a"
}
```

Use `asset_type: image` for start frames and character references. The ingestion runner uploads the media as a TwelveLabs asset, waits for asset readiness, adds it to `TWELVELABS_KNOWLEDGE_STORE_ID`, and optionally waits for the Jockey knowledge-store item to finish indexing.

Public media URLs must point directly to the image/video bytes. Provider dashboard pages, MovieFlow project pages, Google Drive share pages, and other HTML pages must first be exported or materialized. MovieFlow raw `.mp4` URLs in `sovereign_signal_batch_001.json` are already normalized for the production bootstrap.

## Current automation boundary

- Kling provides direct API workflows for image and video generation. Generated Kling media must be copied into durable storage promptly because provider output retention is time-limited.
- InVideo officially offers an MCP workflow. Direct backend execution requires account-level API credentials; until those are issued, use the MCP/manual export bridge and submit its final media URL or file through the common ingestion envelope.
- MovieFlow scenes already listed in the Sovereign Signal manifest are automatically eligible for the Railway production bootstrap. Additional scenes must be exported to raw media URLs or files and appended as new manifest entries.
- Jockey is a research preview without webhooks. The ingestion runner uses polling for both asset processing and knowledge-store indexing.
