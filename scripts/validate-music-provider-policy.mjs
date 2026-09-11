import { readFile } from 'node:fs/promises';

const path = 'config/music/providers.json';
const config = JSON.parse(await readFile(path, 'utf8'));
const providers = Array.isArray(config.providers) ? config.providers : [];

const failures = [];
const isPinned = (value) => typeof value === 'string' && value.length > 0 && !/^UNPINNED$/i.test(value);

for (const provider of providers) {
  const id = provider?.id ?? '<unknown>';
  const hosted = provider?.hosted_allowed === true;
  const commercial = provider?.commercial_output_allowed === true || provider?.commercial_generation_allowed === true;
  const approval = provider?.approval ?? {};

  if (hosted || commercial) {
    if (!isPinned(provider?.source_revision)) failures.push(`${id}: source_revision must be pinned`);
    if (!isPinned(provider?.model_revision)) failures.push(`${id}: model_revision must be pinned`);
    if (!isPinned(provider?.weights_sha256)) failures.push(`${id}: weights_sha256 must be pinned`);
    if (approval.status !== 'approved') failures.push(`${id}: approval.status must be approved`);
    if (!approval.reviewer) failures.push(`${id}: approval.reviewer is required`);
    if (!approval.reviewed_at) failures.push(`${id}: approval.reviewed_at is required`);
  }

  if (provider?.hosted_allowed === true && provider?.deployment_mode !== 'hosted') {
    failures.push(`${id}: hosted_allowed requires deployment_mode=hosted`);
  }

  if (provider?.commercial_output_allowed === true && provider?.commercial_generation_allowed !== true) {
    failures.push(`${id}: commercial_output_allowed requires commercial_generation_allowed=true`);
  }
}

if (failures.length) {
  console.error('Music provider policy validation FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Music provider policy validation passed (${providers.length} provider(s)); deny-by-default rules are intact.`);
