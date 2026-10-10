import { readFile } from 'node:fs/promises';

const registry = JSON.parse(await readFile('config/music/providers.json', 'utf8'));
const qualification = JSON.parse(await readFile('config/music/qualification.json', 'utf8'));
const aceStepSmoke = JSON.parse(await readFile('config/music/smoke-tests/ace-step-1.5.json', 'utf8'));
const failures = [];
const commitSha = /^[0-9a-f]{40}$/i;
const weightsSha256 = /^(?:sha256:)?[0-9a-f]{64}$/i;

for (const provider of registry.providers) {
  const record = qualification.providers?.[provider.id];
  if (!record) {
    failures.push(`${provider.id}: missing qualification record`);
    continue;
  }

  if (!commitSha.test(provider.source_revision)) failures.push(`${provider.id}: source revision is not an immutable 40-hex commit`);
  if (!commitSha.test(provider.model_revision)) failures.push(`${provider.id}: model revision is not an immutable 40-hex commit`);
  if (record.source_revision !== provider.source_revision) failures.push(`${provider.id}: source revision mismatch`);
  if (record.model_revision !== provider.model_revision) failures.push(`${provider.id}: model revision mismatch`);
  if (record.license !== provider.license) failures.push(`${provider.id}: license mismatch`);

  const hashVerified = record.artifact_hash_status === 'verified';
  const hasWeightDigest = weightsSha256.test(provider.weights_sha256);
  if (hashVerified && !hasWeightDigest) failures.push(`${provider.id}: artifact hash marked verified without a valid SHA-256 digest`);

  const approvalRecorded = provider.approval?.status === 'approved' &&
    Boolean(provider.approval?.reviewer) &&
    Boolean(provider.approval?.reviewed_at) &&
    !Number.isNaN(Date.parse(provider.approval.reviewed_at));

  const ready = hashVerified &&
    hasWeightDigest &&
    record.dependency_license_review === 'verified' &&
    record.gpu_smoke_test === 'passed' &&
    record.audio_qa_test === 'passed' &&
    approvalRecorded;

  if (provider.enabled === true && !ready) failures.push(`${provider.id}: enabled before qualification and reviewer approval completed`);
  if (!ready && record.activation_status !== 'blocked') failures.push(`${provider.id}: incomplete provider must remain blocked`);
  if (provider.enabled === true && record.activation_status !== 'approved') failures.push(`${provider.id}: enabled provider must have approved activation status`);
}

const aceStep = registry.providers.find((provider) => provider.id === 'ace-step-1.5');
if (!aceStep) {
  failures.push('ace-step-1.5: missing provider required by deterministic smoke-test manifest');
} else {
  if (aceStepSmoke.provider_id !== aceStep.id) failures.push('ace-step-1.5: smoke-test provider_id mismatch');
  if (aceStepSmoke.source_revision !== aceStep.source_revision) failures.push('ace-step-1.5: smoke-test source revision mismatch');
  if (aceStepSmoke.model_revision !== aceStep.model_revision) failures.push('ace-step-1.5: smoke-test model revision mismatch');
  if (aceStepSmoke.artifact_requirements?.hash_algorithm !== 'sha256') failures.push('ace-step-1.5: smoke-test must require sha256 artifact hashing');
  if (aceStepSmoke.artifact_requirements?.weights_sha256_required !== true) failures.push('ace-step-1.5: smoke-test must require weight SHA-256 verification');
  if (aceStepSmoke.artifact_requirements?.all_loaded_weight_files_must_be_hashed !== true) failures.push('ace-step-1.5: every loaded production weight file must be hashed');
  if (!Number.isInteger(aceStepSmoke.generation?.seed)) failures.push('ace-step-1.5: smoke-test must define an integer seed');
  if (!(aceStepSmoke.generation?.duration_seconds > 0)) failures.push('ace-step-1.5: smoke-test must define a positive duration');
  if (aceStepSmoke.audio_qa?.required !== true || aceStepSmoke.audio_qa?.must_pass !== true) failures.push('ace-step-1.5: audio QA must be required and passing before activation');
}

if (failures.length) {
  console.error('Music provider qualification validation FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Music provider qualification validation passed (${registry.providers.length} providers).`);
