import { readFile } from 'node:fs/promises';

const registry = JSON.parse(await readFile('config/music/providers.json', 'utf8'));
const qualification = JSON.parse(await readFile('config/music/qualification.json', 'utf8'));
const failures = [];

for (const provider of registry.providers) {
  const record = qualification.providers?.[provider.id];
  if (!record) {
    failures.push(`${provider.id}: missing qualification record`);
    continue;
  }
  if (record.source_revision !== provider.source_revision) failures.push(`${provider.id}: source revision mismatch`);
  if (record.model_revision !== provider.model_revision) failures.push(`${provider.id}: model revision mismatch`);
  if (record.license !== provider.license) failures.push(`${provider.id}: license mismatch`);

  const ready = record.artifact_hash_status === 'verified' &&
    record.dependency_license_review === 'verified' &&
    record.gpu_smoke_test === 'passed' &&
    record.audio_qa_test === 'passed';

  if (!ready && provider.enabled === true) failures.push(`${provider.id}: enabled before qualification completed`);
  if (!ready && record.activation_status !== 'blocked') failures.push(`${provider.id}: incomplete provider must remain blocked`);
}

if (failures.length) {
  console.error('Music provider qualification validation FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Music provider qualification validation passed (${registry.providers.length} providers).`);
