# D3VONN.IO Conversation Agent Audit

**Date:** August 15, 2026  
**Scope:** Browser conversation agent, Vapi call orchestration, ElevenLabs text-to-speech, authenticated Hermes tool calls, and the associated production activation workflow.

## Executive assessment

The trusted production voice backend is operational and reports a configured **Vapi-managed ElevenLabs** runtime, including Vapi private-key and webhook readiness, signed inline browser sessions, ElevenLabs API and voice readiness, the Hermes adapter, and film intelligence.

The browser implementation has been repaired to use the official `@vapi-ai/web` SDK directly. The GitHub production activation workflow now mirrors Railway's supported Vapi server-message policy and no longer reintroduces the retired `assistant-request` event.

The earlier browser blocker has also been resolved. Focused Chromium reproduction showed that the React root itself could remain mounted; the actual route failure was caused by `VoiceStudio` embedding the authenticated `ChatPage`, whose auth effect redirected signed-out visitors to `/login?redirect=/chat`. Voice Studio now preserves the public published-assistant path for signed-out users and gates only the text/Hermes workspace behind sign-in. The application bootstrap also paints a deterministic startup shell and captures App-import or React-render failures instead of allowing an empty `#root`.

A dedicated `Voice Studio Mount Guard` now verifies the post-idle provider transition, the non-empty root, visible main content, absence of the startup-failure state, preservation of the `/voice-studio` URL while signed out, the Voice Studio hero, and the protected-workspace sign-in surface. That Chromium check passes.

| Area | Audit result | Evidence |
|---|---|---|
| Production backend | **Configured and ready** | `GET https://api.d3vonn.io/api/voice/health` reports `status: "configured"` and `browser_voice_ready: true`. |
| Browser Vapi control | **Repaired** | Replaced the HTML-widget wrapper with `@vapi-ai/web` and the official `new Vapi(publicKey)` / `start(assistant)` lifecycle. [1] |
| ElevenLabs delivery | **Configured through Vapi** | The production assistant uses Vapi provider value `11labs` and the designated voice ID. [2] |
| Authenticated Hermes tools | **Preserved** | Signed-in users receive a short-lived inline assistant; unauthenticated published-assistant calls cannot execute Hermes tools. |
| Deployment activation | **Repaired** | GitHub activation filters existing events through the supported policy and adds only required D3VONN events. Live activation is manual-dispatch gated. |
| React application mount | **Repaired and regression-tested** | The fail-visible bootstrap protects `#root`; focused Chromium confirms Voice Studio remains mounted after deferred providers initialize. |
| Signed-out Voice Studio | **Repaired and regression-tested** | Public voice remains on `/voice-studio`; the embedded authenticated Chat redirect no longer hijacks the route. |
| Browser microphone conversation | **Still requires live acceptance** | Automated mount/render certification is green, but a real user-gesture microphone conversation has not yet been certified. |

## Findings and corrective actions

### Browser call lifecycle mismatch

The prior `ConversationalVoiceControls` implementation loaded Vapi's HTML widget script and called `window.vapiSDK.run(...)`, then invoked `vapi.start(...)` on the returned widget object. Vapi's current web documentation specifies the browser SDK lifecycle as `new Vapi(publicKey)` followed by `vapi.start(assistantId or transient assistant)`. [1]

The repair installs `@vapi-ai/web` and creates one lifecycle-managed SDK instance per control. It registers `call-start`, `call-end`, `speech-start`, `speech-end`, `call-start-failed`, and `error` handlers, stops the call on unmount, and disables the control when the required Vapi public key is not built into the frontend.

A signed-in D3VONN user receives a short-lived inline assistant from `POST /api/voice/session`, carrying the user-bound webhook session token. A signed-out user can use the published assistant, while the backend rejects Hermes tool calls unless a validated inline session supplied user identity.

### Vapi and ElevenLabs configuration drift

Railway startup activation removes retired Vapi server-message values. The protected GitHub activation workflow now follows the same policy: it preserves only supported messages and adds the required D3VONN events `tool-calls`, `status-update`, `end-of-call-report`, and `transcript`. The retired `assistant-request` value is therefore removed instead of being carried forward. Vapi documents `assistant-request` for dynamic assistant lookup rather than the direct browser Web SDK flow. [3]

Live provider mutation is now gated to `workflow_dispatch`; pull requests run a safe policy-validation job and do not attempt to enter the protected production environment.

The assistant continues to use Vapi-managed ElevenLabs TTS with `voice.provider: "11labs"` and the configured `voiceId`. [2] The browser receives only public Vapi configuration; Vapi private keys, ElevenLabs API keys, webhook secrets, and session-signing secrets remain server-side.

### React mount and route-hijack diagnosis

The original audit observed an empty React root. The application bootstrap was hardened to render a startup shell before importing the App tree and to display a captured failure if App module evaluation or React rendering throws. This prevents silent blank-root failures and makes future bootstrap regressions diagnosable.

A focused Playwright test then reproduced the Voice Studio route and showed that `#root` remained non-empty and `#main-content` remained visible. The failure was a route transition to `/login?redirect=/chat`.

The cause was the full authenticated `ChatPage` mounted inside the otherwise public `VoiceStudio`. `ChatPage` redirects when no Supabase session exists. Voice Studio now resolves auth independently: signed-out users retain the public Vapi/ElevenLabs voice interface and see a sign-in panel for secure text/Hermes capabilities; signed-in users receive the full Chat workspace.

A dedicated Chromium `Voice Studio Mount Guard` now tests this exact boundary and passes.

## Validation evidence

| Validation | Result |
|---|---|
| TypeScript check: `pnpm typecheck` | Passed in the original repair validation. |
| Production frontend build: `pnpm build` | Passed. |
| Client-bundle credential scan | Passed; no client secret detected. |
| Targeted lint: voice control and voice interface | Passed. |
| Backend voice tests | Passed; **13 tests** covering activation normalization, provider-key behavior, health reporting, webhook authentication, replay handling, assistant lookup, and authenticated tool authorization. |
| Live production health endpoint | Passed; reports configured Vapi-managed ElevenLabs readiness. |
| Vercel preview build | Passed after correcting commit attribution; preview deployments build normally. |
| Final Voice Production Activation PR policy check | Passed; pull requests validate policy without mutating production. |
| Voice Studio Mount Guard — Chromium | Passed; root remains mounted, route remains `/voice-studio`, public hero renders, protected text workspace is gated. |
| Real microphone conversation | Not yet certified; requires an actual browser microphone gesture and conversational session. |

## Deployment configuration

The revised activation guide is located at [`docs/integrations/VAPI_ACTIVATION.md`](../integrations/VAPI_ACTIVATION.md). It documents public Vercel values, trusted Railway values, the smoke-test sequence, and key separation.

After this branch is promoted through the controlled Vercel path, the remaining acceptance sequence is a live browser test in both modes:

1. Signed out: open `/voice-studio`, grant microphone permission, start the published Vapi assistant, converse through the approved ElevenLabs voice, and end cleanly.
2. Signed in: start a short-lived inline session, converse, execute one permitted authenticated Hermes action, verify the tool result, and end cleanly.
3. Inspect browser requests/bundles and confirm no private Vapi, ElevenLabs, webhook, or session-signing secret is exposed.

> The readiness endpoint and automated mount certification are strong configuration and rendering signals, but the final acceptance criterion remains a real microphone conversation through the production browser path.

## References

[1]: https://docs.vapi.ai/quickstart/web "Vapi Web Calls documentation"
[2]: https://docs.vapi.ai/providers/voice/elevenlabs "Vapi ElevenLabs voice provider documentation"
[3]: https://docs.vapi.ai/server-url/events "Vapi server events documentation"
