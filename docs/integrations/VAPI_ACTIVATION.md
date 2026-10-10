# D3VONN.IO Vapi and ElevenLabs activation

D3VONN.IO uses the official Vapi Web SDK for browser conversations. **Vapi owns browser-call orchestration** and its configured ElevenLabs integration supplies production text-to-speech. For signed-in users, the frontend obtains a short-lived inline assistant from the trusted D3VONN API; the session binds permitted Hermes tool calls to that user without exposing provider secrets.

## Deployment variables

| Location | Variable | Scope | Purpose |
|---|---|---|---|
| Vercel | `VITE_VAPI_PUBLIC_KEY` | Public build-time configuration | Starts browser calls through the official Vapi Web SDK. |
| Vercel | `VITE_VAPI_ASSISTANT_ID` | Public build-time configuration | Optional override for the published D3VONN Vapi assistant; the production default is embedded in the application. |
| Vercel | `VITE_API_URL` | Public build-time configuration | Optional override for the D3VONN API base URL; production defaults to `https://api.d3vonn.io`. |
| Railway | `VAPI_PRIVATE_KEY` | Secret | Patches and validates the published Vapi assistant. |
| Railway | `VAPI_ASSISTANT_ID` | Non-secret service configuration | Identifies the published production assistant. |
| Railway | `VAPI_WEBHOOK_SECRET` | Secret | Authenticates Vapi webhooks to the D3VONN backend. |
| Railway | `ELEVENLABS_API_KEY` | Secret | Validates the configured ElevenLabs voice when direct validation is explicitly enabled. |
| Railway | `ELEVENLABS_DEFAULT_VOICE_ID` | Non-secret service configuration | Identifies the voice Vapi uses through its ElevenLabs integration. |
| Railway | `ELEVENLABS_DEFAULT_MODEL` | Non-secret service configuration | Defaults to `eleven_turbo_v2_5`. |
| Railway | `VOICE_SESSION_SIGNING_SECRET` | Secret | Recommended dedicated signer for short-lived authenticated browser voice sessions. |

> Only the Vapi **public** key and assistant identifier belong in Vercel `VITE_` variables. Never place Vapi private keys, ElevenLabs API keys, webhook secrets, or session-signing secrets in a browser build.

## Vapi assistant configuration

The protected voice-activation workflow and Railway startup activation patch the published assistant with the D3VONN webhook, the approved ElevenLabs voice, and the accepted Vapi server-message set. The webhook receives `tool-calls`, `status-update`, `transcript`, and `end-of-call-report` events. It only authorizes Hermes tool execution when the browser used a signed-in, short-lived inline session.

The deployment workflow deliberately excludes the retired `assistant-request` server event. Telephone assistant lookup uses a distinct flow from browser Vapi calls and must not be reintroduced into the published assistant server-message configuration.

## Browser smoke test

| Step | Expected result |
|---|---|
| Deploy the branch to a Vercel preview. | The Voice Studio route renders the D3VONN Voice Assistant panel. |
| Open `/voice-studio`. | The status badge reads `Vapi + ElevenLabs configured`. |
| Tap the phone control and approve microphone access. | A Vapi browser call starts and the control changes to the connected state. |
| Speak a general question. | The response is synthesized by the ElevenLabs voice configured within Vapi. |
| Sign in and ask for a supported Hermes action. | The API issues an inline assistant session and the authenticated tool-call path executes or queues the permitted request. |
| End the call. | The same control disconnects the Vapi session. |
| Inspect page source and network requests. | No Vapi private key, ElevenLabs API key, webhook secret, or session-signing secret is present. |

## Operational checks

The public endpoint `GET https://api.d3vonn.io/api/voice/health` reports readiness without exposing credentials. Production is ready only when it reports `status: "configured"`, `browser_voice_ready: true`, and the Vapi, webhook, inline-session, ElevenLabs, and Hermes checks as true.

PSTN provisioning, outbound campaigns, and any consent, DNC, disclosure, opt-out, and audit controls remain separately gated workstreams.
