import type { WearableDevice, WearableEvent } from '@/types/wearable';

export interface WearableAdapter {
  readonly id: string;
  canHandle(device: Pick<WearableDevice, 'vendor' | 'model'>): boolean;
  normalizeEvent(event: unknown): WearableEvent;
}

const adapters = new Map<string, WearableAdapter>();

export function registerWearableAdapter(adapter: WearableAdapter): void {
  if (adapters.has(adapter.id)) {
    throw new Error(`Wearable adapter already registered: ${adapter.id}`);
  }
  adapters.set(adapter.id, adapter);
}

export function getWearableAdapter(id: string): WearableAdapter | undefined {
  return adapters.get(id);
}

export function listWearableAdapters(): WearableAdapter[] {
  return [...adapters.values()];
}

export function findWearableAdapter(
  device: Pick<WearableDevice, 'vendor' | 'model'>,
): WearableAdapter | undefined {
  return listWearableAdapters().find((adapter) => adapter.canHandle(device));
}
