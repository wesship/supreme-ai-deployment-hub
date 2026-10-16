import { describe, expect, it } from 'vitest';
import { canRunSeparation, createDisabledStemGateway, validateStemJob, type StemJob, type StemQualification } from '../music/stemSeparationContract';

const approval: StemQualification = {
  source_revision: 'a'.repeat(40), model_revision: 'b'.repeat(40),
  weights_sha256: 'c'.repeat(64), license_review: 'approved', audio_qa: 'passed',
  operator_approved: true, enabled: true,
};
const job: StemJob = {
  job_id: 'job-1', status: 'succeeded', model: 'demucs',
  source_sha256: 'a'.repeat(64), user_id: 'user-1',
  created_at: '2026-10-15T00:00:00Z', progress: 100,
  artifacts: [{ kind: 'vocals', storage_key: 'jobs/job-1/vocals.wav',
    sha256: 'b'.repeat(64), size_bytes: 400, sample_rate: 44100, channels: 2 }],
};
describe('Gate 8 separation contracts', () => {
  it('requires every qualification gate before dispatch', () => {
    expect(canRunSeparation()).toBe(false);
    expect(canRunSeparation({ ...approval, enabled: false })).toBe(false);
    expect(canRunSeparation({ ...approval, audio_qa: 'pending' })).toBe(false);
    expect(canRunSeparation({ ...approval, license_review: 'pending' })).toBe(false);
    expect(canRunSeparation({ ...approval, operator_approved: false })).toBe(false);
    expect(canRunSeparation({ ...approval, weights_sha256: 'unverified' })).toBe(false);
    expect(canRunSeparation(approval)).toBe(true);
  });
  it('rejects untrusted artifact paths and invalid outputs', () => {
    expect(validateStemJob(job)).toBe(true);
    expect(validateStemJob({ ...job, artifacts: [] })).toBe(false);
    expect(validateStemJob({ ...job, progress: 101 })).toBe(false);
    expect(validateStemJob({ ...job, artifacts: [{ ...job.artifacts[0], storage_key: '../secret' }] })).toBe(false);
    expect(validateStemJob({ ...job, artifacts: [{ ...job.artifacts[0], size_bytes: -1 }] })).toBe(false);
  });
  it('fails visibly instead of calling an unqualified backend', async () => {
    const gateway = createDisabledStemGateway();
    await expect(gateway.submit({ upload_id: 'u', source_sha256: 'a'.repeat(64), model: 'demucs', idempotency_key: 'key' }))
      .rejects.toThrow('STEM_SEPARATION_NOT_QUALIFIED');
    await expect(gateway.get('job-1')).rejects.toThrow('STEM_SEPARATION_NOT_QUALIFIED');
    await expect(gateway.cancel('job-1')).rejects.toThrow('STEM_SEPARATION_NOT_QUALIFIED');
  });
});
