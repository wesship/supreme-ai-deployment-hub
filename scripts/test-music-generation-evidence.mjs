#!/usr/bin/env node

import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = await mkdtemp(path.join(tmpdir(), 'd3vonn-music-generation-evidence-'));
const evidencePath = path.join(root, 'evidence.json');
const digest = 'a'.repeat(64);
const base = {
  schema_version: 1,
  provider_id: 'ace-step-1.5',
  source_revision: 'ca1e85fe9430179831e6bc6be790c332190a3866',
  model_revision: '19671f406d603126926c1b7e2adc169acbcade22',
  weights_manifest_sha256: digest,
  runtime_image_sha256: 'b'.repeat(64),
  gpu_model: 'Synthetic NVIDIA GPU',
  gpu_driver: 'synthetic-driver',
  cuda_version: 'synthetic-cuda',
  torch_version: 'synthetic-torch',
  total_generations: 25,
  successful_generations: 25,
  failed_generations: 0,
  generation_error_rate: 0,
  p50_generation_seconds: 30,
  p95_generation_seconds: 120,
  peak_vram_gb: 8,
  deterministic_seed_match: true,
  audio_qa_passed: true,
  audio_qa_report_sha256: 'c'.repeat(64),
  provenance_manifest_sha256: 'd'.repeat(64),
  review_status: 'PENDING_REVIEW'
};

function run(expectedSuccess) {
  const result = spawnSync(process.execPath, ['scripts/validate-music-generation-evidence.mjs', evidencePath], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  if ((result.status === 0) !== expectedSuccess) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error(`validator exit ${result.status}; expected success=${expectedSuccess}`);
  }
}

async function check(candidate, expectedSuccess) {
  await writeFile(evidencePath, JSON.stringify(candidate));
  run(expectedSuccess);
}

await check(base, true);

const boundary = {
  ...base,
  total_generations: 50,
  successful_generations: 49,
  failed_generations: 1,
  generation_error_rate: 0.02
};
await check(boundary, true);

for (const mutation of [
  { successful_generations: 24, total_generations: 24 },
  { total_generations: 26, successful_generations: 25, failed_generations: 0 },
  { total_generations: 26, successful_generations: 25, failed_generations: 1, generation_error_rate: 0 },
  { total_generations: 50, successful_generations: 48, failed_generations: 2, generation_error_rate: 0.04 },
  { p95_generation_seconds: 121 },
  { deterministic_seed_match: false },
  { audio_qa_passed: false },
  { review_status: 'PASS' },
  { weights_manifest_sha256: 'UNPINNED' },
  { model_revision: 'main' },
  { unexpected_activation_state: true }
]) {
  await check({ ...base, ...mutation }, false);
}

const validatorSource = await readFile('scripts/validate-music-generation-evidence.mjs', 'utf8');
for (const requiredGuard of [
  'commercial_output_allowed',
  "provider.approval?.status !== 'pending'",
  'provider.approval?.reviewer !== null',
  'provider.approval?.reviewed_at !== null'
]) {
  if (!validatorSource.includes(requiredGuard)) {
    throw new Error(`missing fail-closed provider guard: ${requiredGuard}`);
  }
}

console.log('PASS: generation evidence validator rejects unauditable counts, unknown fields, activation state, and threshold violations.');
