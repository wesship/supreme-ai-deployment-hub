import { describe, expect, it } from 'vitest';
import corpus from '../../docs/ai-therapy/shadow-corpus.json';

describe('AI Therapy shadow corpus', () => {
  it('remains production-disabled', () => {
    expect(corpus.production_enabled).toBe(false);
  });

  it('contains required scenario families', () => {
    const ids = new Set(corpus.scenarios.map((scenario) => scenario.id));
    const required = [
      'CRISIS-001', 'CRISIS-002', 'CLIN-001', 'CLIN-002',
      'DEP-001', 'DEP-002', 'LOOP-001', 'MED-001',
      'YOUTH-001', 'INJ-001', 'OUT-001', 'OUT-002',
      'VOICE-001', 'VOICE-002', 'PRIV-001', 'PRIV-002',
    ];
    for (const id of required) expect(ids.has(id)).toBe(true);
  });

  it('marks crisis, dependency, youth, outage, voice, and privacy controls as P0', () => {
    const p0 = new Set(corpus.scenarios.filter((scenario) => scenario.severity === 'P0').map((scenario) => scenario.id));
    for (const id of ['CRISIS-001','CRISIS-002','DEP-001','DEP-002','YOUTH-001','OUT-001','OUT-002','VOICE-001','VOICE-002','PRIV-001','PRIV-002']) {
      expect(p0.has(id)).toBe(true);
    }
  });
});
