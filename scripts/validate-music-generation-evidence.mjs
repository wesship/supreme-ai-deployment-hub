#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const SHA40 = /^[0-9a-f]{40}$/i;
const SHA256 = /^[0-9a-f]{64}$/;

function fail(message) {
  throw new Error(message);
}

function finiteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${name} must be a finite number`);
  return value;
}

async function main() {
  const evidencePath = process.argv[2];
  if (!evidencePath) fail('usage: node scripts/validate-music-generation-evidence.mjs <evidence.json>');

  const evidence = JSON.parse(await readFile(path.resolve(evidencePath), 'utf8'));
  const schema = JSON.parse(await readFile('config/music/generation-certification-evidence.schema.json', 'utf8'));
  const registry = JSON.parse(await readFile('config/music/providers.json', 'utf8'));
  const certification = JSON.parse(await readFile('config/music/ace-step-1.5.production-certification.json', 'utf8'));
  const provider = registry.providers?.find((candidate) => candidate.id === 'ace-step-1.5');

  if (!provider) fail('ACE-Step 1.5 provider is missing from registry');
  if (
    provider.enabled !== false ||
    provider.hosted_allowed !== false ||
    provider.commercial_generation_allowed !== false ||
    provider.commercial_output_allowed !== false ||
    provider.approval?.status !== 'pending' ||
    provider.approval?.reviewer !== null ||
    provider.approval?.reviewed_at !== null
  ) {
    fail('ACE-Step must remain fully disabled and unapproved while evidence is pending review');
  }
  if (certification.status !== 'PENDING_EXTERNAL_EVIDENCE' || certification.production_enabled !== false) {
    fail('production certification must remain fail closed while collecting evidence');
  }

  const allowedKeys = new Set(Object.keys(schema.properties ?? {}));
  const requiredKeys = new Set(schema.required ?? []);
  for (const key of Object.keys(evidence)) {
    if (!allowedKeys.has(key)) fail(`unknown evidence field: ${key}`);
  }
  for (const key of requiredKeys) {
    if (!(key in evidence)) fail(`required evidence field missing: ${key}`);
  }

  if (evidence.schema_version !== 1) fail('schema_version must be 1');
  if (evidence.provider_id !== 'ace-step-1.5') fail('provider_id must be ace-step-1.5');
  if (!SHA40.test(evidence.source_revision ?? '') || evidence.source_revision !== provider.source_revision) fail('source_revision does not match the pinned provider revision');
  if (!SHA40.test(evidence.model_revision ?? '') || evidence.model_revision !== provider.model_revision) fail('model_revision does not match the pinned provider revision');

  for (const field of ['weights_manifest_sha256', 'runtime_image_sha256', 'audio_qa_report_sha256', 'provenance_manifest_sha256']) {
    if (!SHA256.test(evidence[field] ?? '')) fail(`${field} must be a lowercase 64-hex SHA-256 digest`);
  }
  for (const field of ['gpu_model', 'gpu_driver', 'cuda_version', 'torch_version']) {
    if (typeof evidence[field] !== 'string' || evidence[field].trim() === '') fail(`${field} is required`);
  }

  if (!Number.isInteger(evidence.total_generations) || evidence.total_generations < certification.requirements.minimum_successful_generations) {
    fail(`total_generations must be >= ${certification.requirements.minimum_successful_generations}`);
  }
  if (!Number.isInteger(evidence.successful_generations) || evidence.successful_generations < certification.requirements.minimum_successful_generations) {
    fail(`successful_generations must be >= ${certification.requirements.minimum_successful_generations}`);
  }
  if (!Number.isInteger(evidence.failed_generations) || evidence.failed_generations < 0) {
    fail('failed_generations must be a non-negative integer');
  }
  if (evidence.successful_generations + evidence.failed_generations !== evidence.total_generations) {
    fail('total_generations must equal successful_generations + failed_generations');
  }

  const errorRate = finiteNumber(evidence.generation_error_rate, 'generation_error_rate');
  const derivedErrorRate = evidence.failed_generations / evidence.total_generations;
  if (Math.abs(errorRate - derivedErrorRate) > Number.EPSILON * 8) {
    fail('generation_error_rate must equal failed_generations / total_generations');
  }
  if (errorRate < 0 || errorRate > certification.requirements.maximum_generation_error_rate) {
    fail(`generation_error_rate must be between 0 and ${certification.requirements.maximum_generation_error_rate}`);
  }

  const p50 = finiteNumber(evidence.p50_generation_seconds, 'p50_generation_seconds');
  const p95 = finiteNumber(evidence.p95_generation_seconds, 'p95_generation_seconds');
  if (p50 <= 0 || p95 <= 0 || p50 > p95) fail('generation latency percentiles must be positive and p50 <= p95');
  if (p95 > certification.requirements.maximum_p95_generation_seconds) {
    fail(`p95_generation_seconds must be <= ${certification.requirements.maximum_p95_generation_seconds}`);
  }
  if (finiteNumber(evidence.peak_vram_gb, 'peak_vram_gb') <= 0) fail('peak_vram_gb must be > 0');
  if (evidence.deterministic_seed_match !== true) fail('deterministic_seed_match must be true');
  if (evidence.audio_qa_passed !== true) fail('audio_qa_passed must be true');
  if (evidence.review_status !== 'PENDING_REVIEW') fail('review_status must remain PENDING_REVIEW');

  console.log('PASS: ACE-Step generation certification evidence is complete, internally auditable, and remains pending human review.');
}

main().catch((error) => {
  console.error(`music generation evidence validation failed: ${error.message}`);
  process.exitCode = 1;
});
