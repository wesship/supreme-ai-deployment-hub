import { describe, expect, it } from 'vitest';
import {
  buildHudRenderEvent,
  type HudRenderRequest,
} from './hud';

const base: HudRenderRequest = {
  event_id: 'evt-hud-1',
  occurred_at: '2026-09-26T20:00:00.000Z',
  device_id: 'xreal-one-pro-1',
  session_id: 'session-1',
  correlation_id: 'corr-1',
  trace_id: 'trace-1',
  text: 'Hermes task complete',
};

describe('buildHudRenderEvent', () => {
  it('creates a canonical display action without vendor-specific coordinator fields', () => {
    const event = buildHudRenderEvent(base);

    expect(event.event_type).toBe('wearable.action.requested');
    expect(event.source.adapter).toBe('d3vonn-hud-runtime');
    expect(event.capabilities).toEqual(['display', 'commands']);
    expect(event.payload).toEqual({
      action: 'display.hud.render',
      surface: 'primary',
      text: 'Hermes task complete',
    });
  });

  it('supports bounded transient HUD metadata', () => {
    const event = buildHudRenderEvent({
      ...base,
      surface: 'notification',
      ttl_ms: 5000,
      priority: 'high',
    });

    expect(event.payload).toMatchObject({
      surface: 'notification',
      ttl_ms: 5000,
      priority: 'high',
    });
  });

  it('rejects empty content', () => {
    expect(() => buildHudRenderEvent({ ...base, text: '   ' })).toThrow('must not be empty');
  });

  it('rejects unbounded display lifetime', () => {
    expect(() => buildHudRenderEvent({ ...base, ttl_ms: 60_001 })).toThrow('ttl_ms');
  });
});
