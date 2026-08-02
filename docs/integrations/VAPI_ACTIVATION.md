# D3VONN.IO Vapi activation

The frontend now prefers Vapi when both publishable values are present and automatically falls back to the existing ElevenLabs agent when they are not.

## Vercel production variables

```env
VITE_VOICE_PROVIDER=vapi
VITE_VAPI_PUBLIC_KEY=<Vapi public key>
VITE_VAPI_ASSISTANT_ID=<D3VONN Vapi assistant ID>
VITE_ELEVENLABS_AGENT_ID=<optional direct ElevenLabs fallback agent ID>
```

Only the Vapi **public** key and assistant identifier belong in Vercel frontend variables.

## Railway or other trusted backend variables

```env
VAPI_PRIVATE_KEY=<Vapi private key>
VAPI_WEBHOOK_SECRET=<random production secret>
ELEVENLABS_API_KEY=<private ElevenLabs API key when ElevenLabs is used by Vapi>
```

Never add private provider keys to a `VITE_` variable.

## Vapi dashboard

1. Create or select the `D3VONN Voice Agent` assistant.
2. Select ElevenLabs as its voice provider and choose the approved D3VONN voice.
3. Configure the production server URL for Hermes events and tool calls.
4. Attach a Vapi Custom Credential to the server URL. Bearer-token or HMAC authentication is preferred.
5. Keep outbound calling disabled until the consent, DNC, permitted-hours, disclosure, opt-out, and audit controls in `VAPI_HERMES_INTEGRATION_BLUEPRINT.md` are verified.

## Browser smoke test

1. Deploy the branch to a Vercel preview.
2. Open the D3VONN voice surface.
3. Confirm the status badge says `Vapi + ElevenLabs configured`.
4. Tap the phone control and approve microphone access.
5. Confirm a Vapi call begins and can be ended from the same control.
6. Confirm no private Vapi or ElevenLabs key appears in page source, JavaScript bundles, or browser network request payloads.
7. Remove the Vapi variables temporarily and verify the existing ElevenLabs fallback still starts.

## Rollout scope

This activation enables the browser-initiated inbound voice surface. PSTN provisioning, server-side Hermes tools, transcript persistence, and outbound campaigns remain separately gated workstreams.
