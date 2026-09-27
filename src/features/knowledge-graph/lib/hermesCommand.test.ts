import { describe, expect, it } from 'vitest';
import type { HermesBrowserCommandRequest } from './hermesCommand';

describe('Hermes browser command contract', () => {
  it('supports governed graph and direct instruction actions', () => {
    const actions: HermesBrowserCommandRequest['action'][] = [
      'run',
      'monitor',
      'connect',
      'ask',
      'command',
    ];
    expect(actions).toEqual(['run', 'monitor', 'connect', 'ask', 'command']);
  });
});