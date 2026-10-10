export type WearableCapability =
  | 'camera'
  | 'microphone'
  | 'speaker'
  | 'display'
  | 'telemetry'
  | 'commands';

export type WearableEventType =
  | 'wearable.connected'
  | 'wearable.disconnected'
  | 'vision.frame.received'
  | 'vision.scene.detected'
  | 'vision.entity.detected'
  | 'audio.command.received'
  | 'audio.response.generated'
  | 'wearable.action.requested'
  | 'wearable.action.executed'
  | 'wearable.action.failed'
  | 'approval.requested'
  | 'approval.completed'
  | 'wearable.alert'
  | 'wearable.emergency';

export interface WearableEvent<T = unknown> {
  event_id: string;
  event_type: WearableEventType;
  occurred_at: string;
  source: {
    adapter: string;
    device_id: string;
    session_id: string;
  };
  correlation_id: string;
  privacy: {
    classification: 'user_private' | 'sensitive' | 'restricted';
    consent: boolean;
  };
  payload: T;
  capabilities: WearableCapability[];
  audit: {
    policy_version: string;
    trace_id: string;
  };
}

export interface WearableDevice {
  id: string;
  name: string;
  vendor: string;
  model: string;
  adapter: string;
  status: 'connected' | 'disconnected' | 'degraded' | 'unknown';
  battery_percent?: number;
  firmware?: string;
  sdk_version?: string;
  capabilities: WearableCapability[];
  last_seen_at?: string;
}
