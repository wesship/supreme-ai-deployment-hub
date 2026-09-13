import { assessSafety, type SafetyAssessment } from './safetyKernel';

export type ContextKind = 'journal' | 'screening';
export type ScreeningInstrumentId = 'external-reviewed';

export interface TenantScope {
  tenantId: string;
  userId: string;
}

export interface ConsentState {
  granted: boolean;
  purpose: 'ai-therapy-support';
  policyVersion: string;
  grantedAt?: string;
}

export interface Provenance {
  source: 'user-entered' | 'approved-screening-adapter';
  schemaVersion: string;
  instrumentId?: ScreeningInstrumentId;
  instrumentVersion?: string;
  scoringVersion?: string;
}

export interface JournalEntryInput extends TenantScope {
  text: string;
  consent: ConsentState;
  provenance?: Provenance;
}

export interface ScreeningResultInput extends TenantScope {
  consent: ConsentState;
  score: number;
  maxScore: number;
  provenance: Provenance;
  summaryText?: string;
}

export interface TherapyContextRecord extends TenantScope {
  kind: ContextKind;
  safety: SafetyAssessment;
  consentPolicyVersion: string;
  provenance: Provenance;
  payload: {
    text?: string;
    score?: number;
    maxScore?: number;
  };
}

export interface TherapyContextStore {
  put(record: TherapyContextRecord): Promise<void>;
  list(scope: TenantScope): Promise<TherapyContextRecord[]>;
  deleteAll(scope: TenantScope): Promise<number>;
}

export class TherapyContextError extends Error {}

function assertTenantScope(scope: TenantScope): void {
  if (!scope.tenantId.trim() || !scope.userId.trim()) {
    throw new TherapyContextError('tenantId and userId are required');
  }
}

function assertConsent(consent: ConsentState): void {
  if (!consent.granted || consent.purpose !== 'ai-therapy-support' || !consent.policyVersion.trim()) {
    throw new TherapyContextError('explicit AI Therapy support consent is required');
  }
}

function defaultJournalProvenance(): Provenance {
  return { source: 'user-entered', schemaVersion: '1' };
}

export function buildJournalRecord(input: JournalEntryInput): TherapyContextRecord {
  assertTenantScope(input);
  assertConsent(input.consent);
  const safety = assessSafety({ text: input.text });

  return {
    tenantId: input.tenantId,
    userId: input.userId,
    kind: 'journal',
    safety,
    consentPolicyVersion: input.consent.policyVersion,
    provenance: input.provenance ?? defaultJournalProvenance(),
    payload: { text: input.text },
  };
}

export function buildScreeningRecord(input: ScreeningResultInput): TherapyContextRecord {
  assertTenantScope(input);
  assertConsent(input.consent);
  if (input.provenance.source !== 'approved-screening-adapter') {
    throw new TherapyContextError('screening results require approved-screening-adapter provenance');
  }
  if (!Number.isFinite(input.score) || !Number.isFinite(input.maxScore) || input.score < 0 || input.maxScore <= 0 || input.score > input.maxScore) {
    throw new TherapyContextError('invalid screening score');
  }

  const safety = assessSafety({ text: input.summaryText ?? '' });
  return {
    tenantId: input.tenantId,
    userId: input.userId,
    kind: 'screening',
    safety,
    consentPolicyVersion: input.consent.policyVersion,
    provenance: input.provenance,
    payload: { score: input.score, maxScore: input.maxScore },
  };
}

export async function saveJournalEntry(store: TherapyContextStore, input: JournalEntryInput): Promise<TherapyContextRecord> {
  const record = buildJournalRecord(input);
  await store.put(record);
  return record;
}

export async function saveScreeningResult(store: TherapyContextStore, input: ScreeningResultInput): Promise<TherapyContextRecord> {
  const record = buildScreeningRecord(input);
  await store.put(record);
  return record;
}

export async function exportTherapyContext(store: TherapyContextStore, scope: TenantScope): Promise<TherapyContextRecord[]> {
  assertTenantScope(scope);
  const rows = await store.list(scope);
  return rows.filter((row) => row.tenantId === scope.tenantId && row.userId === scope.userId);
}

export async function deleteTherapyContext(store: TherapyContextStore, scope: TenantScope): Promise<number> {
  assertTenantScope(scope);
  return store.deleteAll(scope);
}
