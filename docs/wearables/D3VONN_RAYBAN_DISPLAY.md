# D3VONN Ray-Ban Display

## Purpose

`/glasses` is the first Display Web App surface for the D3VONN Wearable OS. It is intentionally separate from the desktop operator dashboard and is optimized for a glanceable 600x600 wearable surface.

## Architecture

```text
Ray-Ban Display Web App
        |
        v
D3VONN /glasses
        |
        v
POST /api/v1/vision/events
        |
        v
wearable_events ledger
        |
        +--> D3VONN agents / PRIMETIME / HNF Radio
```

## Security boundary

- No Supabase service-role key is shipped to the browser.
- Wearable events require an authenticated backend user.
- Capture events require explicit consent metadata.
- Vision events require a declared camera capability.
- Audio events require microphone or speaker capability.
- Event IDs are unique and payloads are hashed before persistence.
- Raw media is not persisted in `wearable_events`; store only approved references or derived data.
- Consequential agent actions remain behind the existing D3VONN policy/approval layer.

## Display UX

The UI uses a dark canvas, large type, shallow navigation, focusable controls, and keyboard arrow/Enter equivalents for simulator testing. The control model is designed to map cleanly to Display Web App navigation and should be verified against the current Meta Developer Center requirements before production release.

## Configuration

Set `VITE_API_BASE_URL` to the authenticated D3VONN API origin when the web app is not served from the same origin as the API. Do not put privileged API keys in any `VITE_*` variable.

## Device rollout

1. Register the D3VONN wearable project in Meta's Wearables Developer Center.
2. Enable the Display Web App/developer preview capability for the test organization.
3. Deploy this repository to a stable HTTPS URL.
4. Add the `/glasses` URL as the Display Web App in the Meta AI app/developer workflow.
5. Validate focus navigation, display readability, authentication, consent, and API failure behavior on physical Display hardware.
6. Keep production release behind the existing D3VONN CI/security gates until device tests pass.

## Current limitation

Meta's wearable platform is a developer-preview surface and capabilities evolve. The repository therefore keeps vendor-specific device behavior behind the Wearable OS adapter boundary instead of coupling business logic directly to Meta APIs.
