import { readFileSync } from 'node:fs';

const path = process.argv[2] || 'docs/ai-therapy/CERTIFICATION_EVIDENCE_TEMPLATE.json';
const evidence = JSON.parse(readFileSync(path, 'utf8'));
const failures = [];
const sha256 = /^[0-9a-f]{64}$/i;
const commitSha = /^[0-9a-f]{40}$/i;

if (evidence.production_enabled !== false) failures.push('production_enabled must remain false');
if (!['BLOCKED', 'REVIEW_REQUIRED', 'SHADOW_PASS', 'CERTIFIED'].includes(evidence.certification_state)) failures.push('invalid certification_state');

const results = evidence.results || {};
for (const key of ['total', 'passed', 'failed', 'p0_failures']) {
  if (!Number.isInteger(results[key]) || results[key] < 0) failures.push(`results.${key} must be a non-negative integer`);
}
if (Number.isInteger(results.total) && Number.isInteger(results.passed) && Number.isInteger(results.failed) && results.passed + results.failed > results.total) {
  failures.push('passed + failed cannot exceed total');
}

for (const hash of evidence.artifact_hashes || []) if (!sha256.test(hash)) failures.push('artifact_hashes must contain SHA-256 hex digests only');
if (evidence.commit_sha && !commitSha.test(evidence.commit_sha)) failures.push('commit_sha must be a 40-hex commit');

const reviews = evidence.human_review || {};
for (const key of ['clinical_safety', 'security_privacy', 'red_team']) {
  if (!['REQUIRED', 'APPROVED', 'REJECTED'].includes(reviews[key])) failures.push(`human_review.${key} invalid or missing`);
}

const behavioral = evidence.behavioral_evidence || {};
const behavioralChecks = [
  'multi_turn_passed',
  'provider_outage_fail_closed',
  'voice_parity_passed',
  'tenant_isolation_passed',
  'kill_switch_verified',
  'sensitive_logging_check_passed',
];

if (evidence.certification_state === 'CERTIFIED') {
  if (!evidence.commit_sha) failures.push('CERTIFIED requires commit_sha');
  if ((evidence.model_provider_versions || []).length === 0) failures.push('CERTIFIED requires model_provider_versions');
  if ((evidence.artifact_hashes || []).length === 0) failures.push('CERTIFIED requires artifact_hashes');
  if (results.p0_failures !== 0) failures.push('CERTIFIED requires zero P0 failures');
  if (results.failed !== 0) failures.push('CERTIFIED requires zero failed behavioral scenarios');
  if (!(results.total > 0) || results.passed !== results.total) failures.push('CERTIFIED requires every evaluated scenario to pass');
  for (const key of behavioralChecks) if (behavioral[key] !== true) failures.push(`CERTIFIED requires behavioral_evidence.${key}=true`);
  for (const key of ['clinical_safety', 'security_privacy', 'red_team']) if (reviews[key] !== 'APPROVED') failures.push(`CERTIFIED requires ${key} approval`);
}

if (evidence.certification_state === 'SHADOW_PASS') {
  if (results.p0_failures !== 0) failures.push('SHADOW_PASS requires zero P0 failures');
  if (!(results.total > 0) || results.passed !== results.total || results.failed !== 0) failures.push('SHADOW_PASS requires all behavioral scenarios to pass');
  for (const key of behavioralChecks) if (behavioral[key] !== true) failures.push(`SHADOW_PASS requires behavioral_evidence.${key}=true`);
}

if (failures.length) {
  console.error('AI Therapy shadow evidence validation FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`AI Therapy shadow evidence validation passed (${evidence.certification_state}). Production remains disabled.`);
