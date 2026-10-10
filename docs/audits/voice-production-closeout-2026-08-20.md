# D3VONN.IO Voice Production Closeout — 2026-08-20

## Purpose

Close the production verification gaps identified during the D3VONN.IO Voice Assistant audit without weakening authentication, provider authorization, or CI/security controls.

## Canonical architecture

```text
D3VONN.IO /voice-studio
        |
        v
Vapi WebRTC client
        |
        v
POST https://api.d3vonn.io/api/voice/session
        |
        +--> ElevenLabs voice provider
        |
        +--> authenticated Vapi webhook
                 |
                 +--> Hermes task engine
                 +--> Jockey / TwelveLabs film intelligence
```

## Required production evidence

- Public `/voice-studio` returns HTTP 200.
- `api.d3vonn.io` resolves and completes TLS/HTTP negotiation.
- `/api/voice/session` is published and protected; unauthenticated requests must not be treated as successful authenticated sessions.
- Production response includes security headers including HSTS, X-Content-Type-Options, CSP, and microphone policy.
- The protected Voice Live Browser Certification workflow passes both signed-out and authenticated WebRTC lifecycles.
- Authenticated voice session contains the expected ElevenLabs provider and Hermes tool without exposing server secrets.
- Production deployment must correspond to the current canonical `main` commit before final certification.

## Automated safeguards

`Voice Production Health` runs every 15 minutes and can also be dispatched manually. It verifies the public frontend, API DNS/TLS reachability, voice-session route publication, and production security headers.

`Voice Live Browser Certification` remains the authoritative end-to-end call test. It is intentionally manual and protected because it creates real production voice calls.

## Security decisions

- Do not bypass required checks or the open-source security controls documented in `docs/security/OPEN_SOURCE_SECURITY_BASELINE.md`.
- Do not expose Vapi private keys, webhook secrets, Supabase access tokens, or Hermes credentials to the browser.
- Do not treat a 401/403/405 from an unauthenticated voice-session probe as a production failure; those responses can demonstrate that the route is protected/published.
- Do not mark the voice assistant production-certified solely from static UI or source tests.

## Final acceptance

The Voice Assistant audit is **production-certified only after**:

1. The production deployment is proven to contain the canonical current `main` revision.
2. `Voice Production Health` passes.
3. `Voice Live Browser Certification` passes both signed-out and authenticated tests.
4. No corresponding production runtime errors remain for the certification window.
