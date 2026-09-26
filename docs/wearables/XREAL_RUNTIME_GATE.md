# XREAL Spatial HUD runtime gate

This gate adds the application-side runtime primitives needed after the staged XREAL adapter contract.

## Included

- explicit built-in adapter registration through `registerBuiltInWearableAdapters()`
- canonical HUD event builder through `buildHudRenderEvent()`
- bounded text and TTL validation
- `display.hud.render` payloads with vendor-neutral surfaces
- idempotent adapter registration tests

## Deliberately not activated

The built-in registration function is not called automatically at application startup yet. The wearable ingress remains behind the existing schema/access activation gate. This prevents a code-only change from implying live hardware connectivity.

## Hermes response handoff

A future authenticated Hermes response bridge should map a safe, displayable result into:

```ts
buildHudRenderEvent({
  event_id,
  occurred_at,
  device_id,
  session_id,
  correlation_id,
  trace_id,
  text: hermesResult.summary,
  surface: 'primary',
  ttl_ms: 8000,
});
```

The resulting canonical event can then be delivered by the host bridge to the XREAL display surface.

## Next activation requirements

1. staging wearable event ledger certified
2. authenticated ingress enabled
3. built-in adapter registration wired into the approved composition root
4. Hermes response bridge added behind policy checks
5. physical XREAL host/device transport implementation
6. hardware-in-the-loop certification
