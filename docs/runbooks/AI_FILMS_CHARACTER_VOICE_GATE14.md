# AI Films Gate 14 — character voice preview

This draft PR stacks on Gate 13. It adds a voice-only rehearsal of the latest published character role using the existing Vapi web assistant and an approved ElevenLabs voice ID. Character preview tokens bind the owner, project, character, role, release version and profile hash for at most ten minutes. The webhook rejects all tool calls from these tokens and separates their idempotency cache from general voice sessions.

## Staging acceptance

1. Complete the ordered Gate 9, 11 and 13 migration checks, then publish a test character role with a real ElevenLabs voice ID in `voice_version`. Check that the voice ID has an approved license and explicit consent where applicable.
2. Configure `AI_FILMS_APPROVED_ELEVENLABS_VOICES` server-side as a comma-separated list of approved voice IDs. Set `AI_FILMS_ROLE_STUDIO_ENABLED=true` and `AI_FILMS_CHARACTER_VOICE_PREVIEW_ENABLED=true` only in staging. Build the staging client with `VITE_AI_FILMS_ROLE_STUDIO_ENABLED=true` and `VITE_AI_FILMS_CHARACTER_VOICE_PREVIEW_ENABLED=true`.
3. Sign in as project owner. Select a character with a published role, start and stop the voice preview, then switch roles and verify each selected release uses its own voice. Confirm draft-only roles, an unlisted voice ID, an archived character, anonymous users, and non-owner collaborators cannot start previews.
4. Send a Vapi `tool-calls` event using a character preview session and verify every requested tool is rejected without creating a Hermes task or querying film intelligence. Check a general D3VONN voice session still works normally. Verify the signed token expires in ten minutes and a changed character ID or release version fails verification.
5. Check Vapi/ElevenLabs usage, microphone errors, mobile and desktop browser behavior, and the exact commit's CI. The intro is the only reviewed text played. The model is explicitly constrained to voice rehearsal; **it is not connected to the role's approved source content or Hermes role actions**. Do not present this preview as a grounded educator, customer support service, station broadcast, or therapeutic service.

Rollback: unset both preview flags; no role or release data is removed. Keep the gate YELLOW until a staging call proves the audio, permission and webhook behavior. No social publishing or radio broadcast is added.
