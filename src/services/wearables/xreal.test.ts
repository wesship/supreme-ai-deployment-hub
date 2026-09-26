import { describe, expect, it } from 'vitest';
import { XREAL_HUD_ACTION, xrealOneAdapter } from './xreal';

const validEvent = {
  event_id: 'evt-1',
  event_type: 'wearable.action.requested',
  occurred_at: '2026-09-26T19:00:00.000Z',
  device_id: 'xreal-one-pro-1',
  session_id: 'session-1',
  correlation_id: 'corr-1',
  privacy: {
    classification: 'user_private',
    consent: true,
  },
  payload: {
    action: XREAL_HUD_ACTION,
    surface: 'primary',
    text: 'Hermes task complete',
  },
  capabilities: ['display', 'commands'],
  trace_id: 'trace-1',
};

describe('xrealOneAdapter', () => {
  it('matches XREAL One-family devices without coupling the coordinator to a vendor SDK', () => {
    expect(xrealOneAdapter.canHandle({ vendor: 'XREAL', model: 'One Pro' })).toBe(true);
    expect(xrealOneAdapter.canHandle({ vendor: 'xreal', model: 'Air 2' })).toBe(true);
    expect(xrealOneAdapter.canHandle({ vendor: 'Meta', model: 'Ray-Ban' })).toBe(false);
  });

  it('normalizes host-bridge events into the canonical wearable contract', () => {
    const normalized = xrealOneAdapter.normalizeEvent(validEvent);

    expect(normalized.source).toEqual({
      adapter: 'xreal-one-host-bridge',
      device_id: 'xreal-one-pro-1',
      session_id: 'session-1',
    });
    expect(normalized.event_type).toBe('wearable.action.requested');
    expect(normalized.capabilities).toEqual(['display', 'commands']);
    expect(normalized.audit).toEqual({
      policy_version: 'wearable-v1',
      trace_id: 'trace-1',
    });
  });

  it('fails closed when consent metadata is absent', () => {
    expect(() =>
      xrealOneAdapter.normalizeEvent({
        ...validEvent,
        privacy: { classification: 'user_private' },
      }),
    ).toThrow('explicit consent state');
  });

  it('fails closed for unknown capabilities', () => {
    expect(() =>
      xrealOneAdapter.normalizeEvent({
        ...validEvent,
        capabilities: ['display', 'root-shell'],
      }),
    ).toThrow('unsupported capability');
  });
});
