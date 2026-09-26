import { getWearableAdapter, registerWearableAdapter } from './registry';
import { xrealOneAdapter } from './xreal';

const BUILT_IN_ADAPTERS = [xrealOneAdapter] as const;

export function registerBuiltInWearableAdapters(): void {
  for (const adapter of BUILT_IN_ADAPTERS) {
    if (!getWearableAdapter(adapter.id)) {
      registerWearableAdapter(adapter);
    }
  }
}

export function listBuiltInWearableAdapterIds(): string[] {
  return BUILT_IN_ADAPTERS.map((adapter) => adapter.id);
}
