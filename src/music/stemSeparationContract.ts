/**
 * Stem separation contract (Gate 8).
 * Deliberately no network dispatch until a qualified backend supplies a reviewed adapter.
 * Never send a user's recording to an inferred or unapproved endpoint.
 */
export type StemModel = 'demucs' | 'audio-separator';
export type StemJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type StemArtifact = {
  kind: 'vocals' | 'drums' | 'bass' | 'other' | 'instrumental';
  storage_key: string;
  sha256: string;
  size_bytes: number;
  sample_rate: number;
  channels: 1 | 2;
};
export type StemJob = {
  job_id: string;
  status: StemJobStatus;
  model: StemModel;
  source_sha256: string;
  user_id: string;
  created_at: string;
  progress: number;
  artifacts: StemArtifact[];
  error_code?: string;
};
export type StemQualification = {
  source_revision: string;
  model_revision: string;
  weights_sha256: string;
  license_review: 'approved' | 'pending' | 'rejected';
  audio_qa: 'passed' | 'pending' | 'failed';
  operator_approved: boolean;
  enabled: boolean;
};

const HEX64 = /^[0-9a-f]{64}$/i;
const HEX40 = /^[0-9a-f]{40}$/i;
export function canRunSeparation(q?: StemQualification): boolean {
  return !!q && HEX40.test(q.source_revision) && HEX40.test(q.model_revision) &&
    HEX64.test(q.weights_sha256.replace(/^sha256:/, '')) &&
    q.license_review === 'approved' && q.audio_qa === 'passed' &&
    q.operator_approved === true && q.enabled === true;
}
export function validateStemJob(job: StemJob): boolean {
  return !!job.job_id && !!job.user_id && HEX64.test(job.source_sha256) &&
    Number.isFinite(job.progress) && job.progress >= 0 && job.progress <= 100 &&
    (job.status !== 'succeeded' || job.artifacts.length > 0) &&
    job.artifacts.every(a =>
      a.storage_key.length > 0 && !a.storage_key.startsWith('/') && !a.storage_key.includes('..') &&
      HEX64.test(a.sha256) && Number.isSafeInteger(a.size_bytes) && a.size_bytes > 0 &&
      Number.isSafeInteger(a.sample_rate) && a.sample_rate > 0 && (a.channels === 1 || a.channels === 2)
    );
}
export type StemSeparationGateway = {
  submit(input: { upload_id: string; source_sha256: string; model: StemModel; idempotency_key: string }): Promise<StemJob>;
  get(jobId: string): Promise<StemJob>;
  cancel(jobId: string): Promise<StemJob>;
};
/** Prevent accidental live activation while the backend qualification gate is open. */
export function createDisabledStemGateway(): StemSeparationGateway {
  const disabled = async (): Promise<never> => {
    throw new Error('STEM_SEPARATION_NOT_QUALIFIED');
  };
  return { submit: disabled, get: disabled, cancel: disabled };
}
