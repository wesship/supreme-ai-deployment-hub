# D3VONN Wearable Display Preview

`/glasses/` is a lightweight, deterministic 600×600-class display preview for D3VONN Wearable OS. It is intentionally independent of the full operator dashboard and works responsively in an ordinary browser.

## Current capability

- glanceable dark display with large typography
- roving keyboard focus using arrow, Home, and End keys
- native Enter/Space activation through accessible buttons
- local previews for D3VONN, HNF Radio, PRIMETIME, and notifications
- external same-origin JavaScript and CSS compatible with the production Content Security Policy
- no browser storage, privileged credentials, raw media capture, API writes, or implied device connectivity

The public page is a simulator. Every action explains the authorization, consent, session, or physical-device gate that must pass before a corresponding live integration is enabled.

## Production boundary

The existing vendor-neutral event contract remains the integration boundary. A future device adapter may send canonical, authenticated events to `POST /api/v1/vision/events`, but this public simulator does not call that endpoint.

Before enabling a hardware adapter:

1. Verify current vendor program and hardware eligibility through the vendor's official developer portal.
2. Register the HTTPS application and callback origins using documented flows only.
3. Implement short-lived, revocable authenticated sessions.
4. Require explicit capture consent and canonical event validation.
5. Keep raw media out of the durable event ledger unless an approved retention policy requires it.
6. Test authorization, idempotency, reconnect, offline behavior, accessibility, and rollback.
7. Certify the experience on supported physical hardware.

No Meta partnership, device support, or physical Ray-Ban certification is claimed by this repository gate.
