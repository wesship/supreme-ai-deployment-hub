import { describe, expect, it } from 'vitest';
import {
  isD3GraphAction,
  normalizeGraphActionRequest,
} from './graphActions';

describe('graph action contract', () => {
  it('accepts the canonical action vocabulary', () => {
    for (const action of [
      'open', 'select', 'trace', 'run', 'monitor', 'connect',
      'expand', 'filter', 'search', 'ask', 'stop',
    ]) {
      expect(isD3GraphAction(action)).toBe(true);
    }
    expect(isD3GraphAction('deploy')).toBe(false);
  });

  it('normalizes Vapi snake_case parameters', () => {
    expect(normalizeGraphActionRequest({
      action: 'connect',
      node_id: 'films',
      target_node_id: 'knowledge',
      query: 'Link reusable character intelligence',
      filter: 'product',
    }, 'voice')).toEqual({
      action: 'connect',
      nodeId: 'films',
      targetNodeId: 'knowledge',
      query: 'Link reusable character intelligence',
      filter: 'product',
      source: 'voice',
    });
  });

  it('rejects unknown actions', () => {
    expect(normalizeGraphActionRequest({ action: 'delete-everything' }, 'voice')).toBeNull();
  });
});
