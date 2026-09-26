import type { WearableCapability, WearableEvent } from '@/types/wearable';
import { XREAL_HUD_ACTION } from './xreal';

export type HudSurface = 'primary' | 'notification' | 'caption' | 'task' | 'context';

export interface HudRenderPayload {
  action: typeof XREAL_HUD_ACTION;
  surface: HudSurface;
  text: string;
  ttl_ms?: number;
  priority?: 'normal' | 'high';
}

export interface HudRenderRequest {
  event_id: string;
  occurred_at: string;
  device_id: string;
  session_id: string;
  correlation_id: string;
  trace_id: string;
  text: string;
  surface?: HudSurface;
  ttl_ms?: number;
  priority?: 'normal' | 'high';
}

const MAX_TEXT_LENGTH = 1000;
const MAX_TTL_MS = 60_000;

export function buildHudRenderEvent(request: HudRenderRequest): WearableEvent<HudRenderPayload> {
  const text = request.text.trim();

  if (!text) {
    throw new Error('HUD text must not be empty');
  }
  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(`HUD text exceeds ${MAX_TEXT_LENGTH} characters`);
  }
  if (request.ttl_ms !== undefined && (request.ttl_ms < 500 || request.ttl_ms > MAX_TTL_MS)) {
    throw new Error(`HUD ttl_ms must be between 500 and ${MAX_TTL_MS}`);
  }

  const capabilities: WearableCapability[] = ['display', 'commands'];

  return {
    event_id: request.event_id,
    event_type: 'wearable.action.requested',
    occurred_at: request.occurred_at,
    source: {
      adapter: 'd3vonn-hud-runtime',
      device_id: request.device_id,
      session_id: request.session_id,
    },
    correlation_id: request.correlation_id,
    privacy: {
      classification: 'user_private',
      consent: true,
    },
    payload: {
      action: XREAL_HUD_ACTION,
      surface: request.surface ?? 'primary',
      text,
      ...(request.ttl_ms !== undefined ? { ttl_ms: request.ttl_ms } : {}),
      ...(request.priority !== undefined ? { priority: request.priority } : {}),
    },
    capabilities,
    audit: {
      policy_version: 'wearable-v1',
      trace_id: request.trace_id,
    },
  };
}
