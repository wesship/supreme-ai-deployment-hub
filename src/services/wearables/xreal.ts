import type {
  WearableCapability,
  WearableDevice,
  WearableEvent,
  WearableEventType,
} from '@/types/wearable';
import type { WearableAdapter } from './registry';

const EVENT_TYPES = new Set<WearableEventType>([
  'wearable.connected',
  'wearable.disconnected',
  'vision.frame.received',
  'vision.scene.detected',
  'vision.entity.detected',
  'audio.command.received',
  'audio.response.generated',
  'wearable.action.requested',
  'wearable.action.executed',
  'wearable.action.failed',
  'approval.requested',
  'approval.completed',
  'wearable.alert',
  'wearable.emergency',
]);

const CAPABILITIES = new Set<WearableCapability>([
  'camera',
  'microphone',
  'speaker',
  'display',
  'telemetry',
  'commands',
]);

const PRIVACY_CLASSES = new Set(['user_private', 'sensitive', 'restricted'] as const);

type PrivacyClass = 'user_private' | 'sensitive' | 'restricted';

interface XrealHostBridgeEvent {
  event_id: string;
  event_type: WearableEventType;
  occurred_at: string;
  device_id: string;
  session_id: string;
  correlation_id: string;
  privacy: {
    classification: PrivacyClass;
    consent: boolean;
  };
  payload: unknown;
  capabilities: WearableCapability[];
  trace_id: string;
  policy_version?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`XREAL bridge event requires non-empty ${key}`);
  }
  return value;
}

function parseEventType(value: unknown): WearableEventType {
  if (typeof value !== 'string' || !EVENT_TYPES.has(value as WearableEventType)) {
    throw new Error('XREAL bridge event contains unsupported event_type');
  }
  return value as WearableEventType;
}

function parseCapabilities(value: unknown): WearableCapability[] {
  if (!Array.isArray(value)) {
    throw new Error('XREAL bridge event requires capabilities');
  }
  const capabilities = value.map((capability) => {
    if (typeof capability !== 'string' || !CAPABILITIES.has(capability as WearableCapability)) {
      throw new Error('XREAL bridge event contains unsupported capability');
    }
    return capability as WearableCapability;
  });
  return [...new Set(capabilities)];
}

function parsePrivacy(value: unknown): XrealHostBridgeEvent['privacy'] {
  if (!isRecord(value)) {
    throw new Error('XREAL bridge event requires privacy metadata');
  }
  const classification = value.classification;
  if (
    typeof classification !== 'string' ||
    !PRIVACY_CLASSES.has(classification as PrivacyClass)
  ) {
    throw new Error('XREAL bridge event contains unsupported privacy classification');
  }
  if (typeof value.consent !== 'boolean') {
    throw new Error('XREAL bridge event requires explicit consent state');
  }
  return {
    classification: classification as PrivacyClass,
    consent: value.consent,
  };
}

function parseBridgeEvent(event: unknown): XrealHostBridgeEvent {
  if (!isRecord(event)) {
    throw new Error('XREAL bridge event must be an object');
  }

  return {
    event_id: requireString(event, 'event_id'),
    event_type: parseEventType(event.event_type),
    occurred_at: requireString(event, 'occurred_at'),
    device_id: requireString(event, 'device_id'),
    session_id: requireString(event, 'session_id'),
    correlation_id: requireString(event, 'correlation_id'),
    privacy: parsePrivacy(event.privacy),
    payload: event.payload ?? {},
    capabilities: parseCapabilities(event.capabilities),
    trace_id: requireString(event, 'trace_id'),
    policy_version:
      typeof event.policy_version === 'string' && event.policy_version.trim()
        ? event.policy_version
        : 'wearable-v1',
  };
}

export const xrealOneAdapter: WearableAdapter = {
  id: 'xreal-one-host-bridge',

  canHandle(device: Pick<WearableDevice, 'vendor' | 'model'>): boolean {
    const vendor = device.vendor.trim().toLowerCase();
    const model = device.model.trim().toLowerCase();
    return vendor === 'xreal' && (model.includes('one') || model.includes('air'));
  },

  normalizeEvent(event: unknown): WearableEvent {
    const raw = parseBridgeEvent(event);

    return {
      event_id: raw.event_id,
      event_type: raw.event_type,
      occurred_at: raw.occurred_at,
      source: {
        adapter: this.id,
        device_id: raw.device_id,
        session_id: raw.session_id,
      },
      correlation_id: raw.correlation_id,
      privacy: raw.privacy,
      payload: raw.payload,
      capabilities: raw.capabilities,
      audit: {
        policy_version: raw.policy_version ?? 'wearable-v1',
        trace_id: raw.trace_id,
      },
    };
  },
};

export const XREAL_HUD_ACTION = 'display.hud.render' as const;
