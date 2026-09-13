#!/usr/bin/env node

import { mkdtemp, writeFile } from 'node:fs/promises';
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
  successful_generations: 25,
  generation_error_rate: 0.02,
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

await writeFile(evidencePath, JSON.stringify(base));
run(true);

for (const mutation of [
  { successful_generations: 24 },
  { generation_error_rate: 0.021 },
  { p95_generation_seconds: 121 },
  { deterministic_seed_match: false },
  { audio_qa_passed: false },
  { review_status: 'PASS' },
  { weights_manifest_sha256: 'UNPINNED' },
  { model_revision: 'main' }
]) {
  await writeFile(evidencePath, JSON.stringify({ ...base, ...mutation }));
  run(false);
}

console.log('PASS: generation evidence validator accepts only complete, threshold-compliant, review-pending evidence.');
