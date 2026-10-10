# Provider setup

Configure provider secrets only in the Railway/VPS backend or protected Supabase Edge Function environment.

```env
XAI_API_KEY=
HIGGSFIELD_API_KEY=
RUNWAY_API_KEY=
LUMA_API_KEY=
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
