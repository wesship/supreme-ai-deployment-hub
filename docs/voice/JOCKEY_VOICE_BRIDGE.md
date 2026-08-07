# Jockey Voice Bridge

This document defines the production boundary for using TwelveLabs Jockey from the authenticated D3VONN.IO Vapi voice experience.

## Security boundary

- `TWELVELABS_API_KEY` and `TWELVELABS_KNOWLEDGE_STORE_ID` remain server-side only.
- Vapi and the browser never receive TwelveLabs credentials.
- Film-intelligence tool calls require an authenticated D3VONN inline voice session.
- The voice webhook calls the existing `backend.ai_films.twelvelabs.TwelveLabsClient` adapter rather than adding a second TwelveLabs client.
- Provider failures are reduced to safe error messages; upstream response bodies and secrets are not logged or returned verbatim.

## Voice capability

The inline assistant may call `query_film_intelligence` for authenticated film questions.

Supported modes:

- `reason`: Jockey corpus-level reasoning over the configured knowledge store. Use for continuity, canon, editorial analysis, scene comparison, and grounded questions across footage.
- `search`: direct TwelveLabs knowledge-store retrieval for ranked clips/images. Use for literal footage lookup.

The tool is intentionally not available to unauthenticated/published-assistant webhook traffic.

## Production environment

Required on the Railway backend:

```text
TWELVELABS_API_KEY
TWELVELABS_KNOWLEDGE_STORE_ID
TWELVELABS_API_BASE_URL=https://api.twelvelabs.io/v1.3
```

No `VITE_TWELVELABS_*` variables are permitted.

## Operational behavior

Jockey calls are bounded by the Vapi server timeout. The bridge uses a shorter internal deadline so the voice session receives a controlled `unavailable` result instead of hanging. For longer research, the assistant should fall back to `create_hermes_task`.

## Example voice requests

- “Check the footage for continuity problems in Legend’s white T-shirt scenes.”
- “Find the strongest clip where Nana warns Legend.”
- “Compare the available Jahid rescue footage with the locked canon.”
- “Search for clips with the Egyptian Temple sequence.”

## Acceptance criteria

1. Signed-in Voice Studio can issue an inline Vapi session.
2. `query_film_intelligence` appears in the assistant tool schema only for that inline session.
3. An authenticated tool call reaches TwelveLabs through the backend adapter.
4. An unauthenticated tool call is rejected.
5. `/api/voice/health` reports whether Jockey film intelligence is configured without exposing secret values.
6. Existing Hermes task behavior continues unchanged.
