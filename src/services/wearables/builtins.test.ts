import { describe, expect, it } from 'vitest';
import { getWearableAdapter, listWearableAdapters } from './registry';
import {
  listBuiltInWearableAdapterIds,
  registerBuiltInWearableAdapters,
} from './builtins';

describe('built-in wearable adapters', () => {
  it('registers the XREAL adapter idempotently', () => {
    registerBuiltInWearableAdapters();
    registerBuiltInWearableAdapters();

    expect(listBuiltInWearableAdapterIds()).toContain('xreal-one-host-bridge');
    expect(getWearableAdapter('xreal-one-host-bridge')).toBeDefined();
    expect(
      listWearableAdapters().filter((adapter) => adapter.id === 'xreal-one-host-bridge'),
    ).toHaveLength(1);
  });
});
