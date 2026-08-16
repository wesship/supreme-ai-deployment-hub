# D3VONN.IO Conversation Agent Audit

**Date:** August 15, 2026  
**Scope:** Browser conversation agent, Vapi call orchestration, ElevenLabs text-to-speech, authenticated Hermes tool calls, and the associated production activation workflow.

## Executive assessment

The trusted production voice backend is already operational. Its public readiness endpoint reports a configured **Vapi-managed ElevenLabs** runtime, including Vapi private-key and webhook readiness, signed inline browser sessions, ElevenLabs API and voice readiness, the Hermes adapter, and film intelligence. The remaining browser-side implementation was not reliably callable because it used Vapi’s legacy HTML-widget wrapper as though it exposed the official Web SDK `start()` lifecycle. The project has been repaired to use the official Vapi Web SDK directly, preserving the secure signed-session design and Vapi-managed ElevenLabs voice path.

The GitHub production activation workflow now mirrors the Railway activation event policy: existing events are filtered through the supported Vapi server-message allowlist and only the required D3VONN events are added. The retired `assistant-request` event is no longer reintroduced.

A separate, pre-existing application-wide client-rendering issue remains: both the live and rebuilt local site leave the React root empty in the audit browser without a captured browser-console exception. This prevents a final human microphone smoke test until the frontend mount issue is resolved or independently reproduced in a standard browser. It does not change the validated backend readiness or the successful static, type, build, secret-scan, and backend-contract test results.

| Area | Audit result | Evidence |
|---|---|---|
| Production backend | **Configured and ready** | `GET https://api.d3vonn.io/api/voice/health` reports `status: "configured"` and `browser_voice_ready: true`. |
| Browser Vapi control | **Repaired** | Replaced HTML-widget-wrapper control with `@vapi-ai/web`, whose documented `new Vapi(publicKey)` and `start(assistant)` lifecycle matches the implementation. [1] |
| ElevenLabs delivery | **Configured through Vapi** | The production assistant uses Vapi provider value `11labs` and the designated voice ID; Vapi documents this as its supported ElevenLabs TTS configuration. [2] |
| Authenticated Hermes tools | **Preserved** | Signed-in users receive a short-lived inline Vapi assistant; unauthenticated published-assistant calls cannot execute Hermes tools. |
| Deployment activation | **Repaired** | The GitHub workflow filters the current event set through the same supported-event policy as Railway startup activation and no longer reintroduces retired `assistant-request`. |
| Browser visual smoke test | **Blocked** | The production and local React roots remain empty after assets load; no testable voice control is rendered in the audit browser. |

## Findings and corrective actions

### Browser call lifecycle mismatch

The prior `ConversationalVoiceControls` implementation loaded Vapi’s HTML widget script and called `window.vapiSDK.run(...)`, then invoked `vapi.start(...)` on the returned widget object. Vapi’s current web documentation specifies the browser SDK lifecycle as `new Vapi(publicKey)` followed by `vapi.start(assistantId or transient assistant)`. [1] The repair installs `@vapi-ai/web` and creates one lifecycle-managed SDK instance per control. It registers `call-start`, `call-end`, `speech-start`, `speech-end`, `call-start-failed`, and `error` handlers, stops the call on unmount, and disables the control when the required Vapi public key is not built into the frontend.

This preserves two intended modes. A signed-in D3VONN user receives a short-lived inline assistant from `POST /api/voice/session`, which carries the user-bound webhook session token. A signed-out user can still use the published assistant, but the backend rejects all Hermes tool calls unless a validated inline session supplied the user identity.

### Vapi and ElevenLabs configuration drift

The Railway startup activator correctly removes retired Vapi server-message values. The protected GitHub activation workflow now follows the same policy: it preserves only events in the supported Vapi server-message allowlist, then adds the required D3VONN events `tool-calls`, `status-update`, `end-of-call-report`, and `transcript`. The retired `assistant-request` value is therefore removed instead of being carried forward. Vapi documents `assistant-request` as a dynamic-assistant lookup event for inbound phone-call setup; browser calls begin directly through the Web SDK and do not require that event. [3]

The assistant continues to use Vapi-managed ElevenLabs TTS. Vapi specifies `voice.provider: "11labs"` and a `voiceId` for this path. [2] The public browser receives only a Vapi public key and assistant identifier; the Vapi private key, ElevenLabs key, webhook secret, and optional session-signing secret remain server-side.

### Application-wide route-mount blocker

`https://www.d3vonn.io/voice-studio` loads its main bundle and its lazily imported Voice Studio, Voice Interface, Chat, and UI chunks, but the React root remains empty. The same behavior occurs against a freshly rebuilt local Vite instance, including the homepage control route. The implementation sources register `/voice-studio` and render the voice panel, so this is not a missing route or asset. It must be diagnosed separately as a global client-mount problem before browser microphone interaction can be certified.

## Validation evidence

| Validation | Result |
|---|---|
| TypeScript check: `pnpm typecheck` | Passed. |
| Production frontend build: `pnpm build` | Passed. |
| Client-bundle credential scan | Passed; 155 text assets inspected with no client secret detected. |
| Targeted lint: voice control and voice interface | Passed. |
| Backend voice tests | Passed; **13 tests** covering activation message normalization, provider-key behavior, health reporting, webhook authentication, replay handling, assistant lookup, and authenticated tool authorization. |
| Live production health endpoint | Passed; reports fully configured Vapi-managed ElevenLabs readiness. |
| Browser microphone conversation | Not certified because the global route-mount blocker leaves the UI empty in the audit browser. |

## Deployment configuration

The revised activation guide is located at [`docs/integrations/VAPI_ACTIVATION.md`](../integrations/VAPI_ACTIVATION.md). It documents the public Vercel values, trusted Railway values, smoke-test sequence, and key-separation policy. After the frontend mount issue is resolved, deploy this repair through the existing controlled Vercel path, then rerun the browser smoke test while authenticated and unauthenticated.

> The production readiness endpoint is a configuration signal, not a substitute for a real microphone conversation. The final acceptance criterion is a rendered Voice Studio control that can start, converse through the approved ElevenLabs voice, perform an authenticated permitted Hermes action, and end cleanly.

## References

[1]: https://docs.vapi.ai/quickstart/web "Vapi Web Calls documentation"
[2]: https://docs.vapi.ai/providers/voice/elevenlabs "Vapi ElevenLabs voice provider documentation"
[3]: https://docs.vapi.ai/server-url/events "Vapi server events documentation"
