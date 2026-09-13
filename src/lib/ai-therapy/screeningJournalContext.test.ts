import { describe, expect, it } from 'vitest';
import {
  buildJournalRecord,
  buildScreeningRecord,
  deleteTherapyContext,
  exportTherapyContext,
  type TherapyContextRecord,
  type TherapyContextStore,
} from './screeningJournalContext';

class MemoryStore implements TherapyContextStore {
  rows: TherapyContextRecord[] = [];

  async put(record: TherapyContextRecord): Promise<void> {
    this.rows.push(record);
  }

  async list(scope: { tenantId: string; userId: string }): Promise<TherapyContextRecord[]> {
    return this.rows.filter((row) => row.tenantId === scope.tenantId && row.userId === scope.userId);
  }

  async deleteAll(scope: { tenantId: string; userId: string }): Promise<number> {
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => !(row.tenantId === scope.tenantId && row.userId === scope.userId));
    return before - this.rows.length;
  }
}

const consent = {
  granted: true as const,
  purpose: 'ai-therapy-support' as const,
  policyVersion: 'consent-1',
  grantedAt: '2026-09-13T18:00:00Z',
};

describe('AI Therapy screening + journaling context', () => {
  it('requires explicit consent', () => {
    expect(() =>
      buildJournalRecord({ tenantId: 't1', userId: 'u1', text: 'journal note', consent: { ...consent, granted: false } }),
    ).toThrow(/consent/i);
  });

  it('routes journal text through the safety kernel', () => {
    const record = buildJournalRecord({ tenantId: 't1', userId: 'u1', text: 'I feel hopeless today.', consent });
    expect(record.kind).toBe('journal');
    expect(record.safety.level).toBe('elevated');
    expect(record.safety.policyVersion).toMatch(/^ai-therapy-safety-/);
  });

  it('rejects unapproved screening provenance', () => {
    expect(() =>
      buildScreeningRecord({
        tenantId: 't1',
        userId: 'u1',
        consent,
        score: 4,
        maxScore: 10,
        provenance: { source: 'user-entered', schemaVersion: '1' },
      }),
    ).toThrow(/approved-screening-adapter/i);
  });

  it('records scores without bundling questionnaire content', () => {
    const record = buildScreeningRecord({
      tenantId: 't1',
      userId: 'u1',
      consent,
      score: 4,
      maxScore: 10,
      provenance: {
        source: 'approved-screening-adapter',
        schemaVersion: '1',
        instrumentId: 'external-reviewed',
        instrumentVersion: 'licensed-version',
        scoringVersion: 'score-v1',
      },
    });
    expect(record.payload).toEqual({ score: 4, maxScore: 10 });
    expect(record.provenance.instrumentId).toBe('external-reviewed');
  });

  it('keeps exports tenant and user scoped and supports deletion', async () => {
    const store = new MemoryStore();
    store.rows.push(
      buildJournalRecord({ tenantId: 't1', userId: 'u1', text: 'a', consent }),
      buildJournalRecord({ tenantId: 't2', userId: 'u2', text: 'b', consent }),
    );

    const exported = await exportTherapyContext(store, { tenantId: 't1', userId: 'u1' });
    expect(exported).toHaveLength(1);
    expect(exported[0].tenantId).toBe('t1');

    const removed = await deleteTherapyContext(store, { tenantId: 't1', userId: 'u1' });
    expect(removed).toBe(1);
    expect(await exportTherapyContext(store, { tenantId: 't1', userId: 'u1' })).toHaveLength(0);
    expect(await exportTherapyContext(store, { tenantId: 't2', userId: 'u2' })).toHaveLength(1);
  });
});
