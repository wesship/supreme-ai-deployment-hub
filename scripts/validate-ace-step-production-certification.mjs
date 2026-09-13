import { readFile } from 'node:fs/promises';

const path = 'config/music/ace-step-1.5.production-certification.json';
const cert = JSON.parse(await readFile(path, 'utf8'));
const failures = [];
const sha256 = /^[0-9a-f]{64}$/i;

if (cert.provider_id !== 'ace-step-1.5') failures.push('provider_id must be ace-step-1.5');
if (cert.production_enabled !== false) failures.push('production_enabled must remain false in certification evidence');

const r = cert.requirements ?? {};
const e = cert.evidence ?? {};

if (r.immutable_source_revision !== true) failures.push('immutable source revision requirement missing');
if (r.immutable_model_revision !== true) failures.push('immutable model revision requirement missing');
if (r.all_loaded_weight_files_sha256 !== true) failures.push('weight-file SHA-256 requirement missing');
if (r.reviewer_approval_required !== true) failures.push('reviewer approval requirement missing');

const evidencePresent = [
  e.weights_manifest_sha256,
  e.gpu_model,
  e.gpu_driver,
  e.torch_version,
  e.ace_step_version,
  e.successful_generations,
  e.generation_error_rate,
  e.p50_generation_seconds,
  e.p95_generation_seconds,
  e.peak_vram_gb,
  e.deterministic_seed_match,
  e.audio_qa_passed,
  e.audio_qa_report_sha256,
  e.provenance_manifest_sha256,
  e.reviewer,
  e.reviewed_at,
].every((v) => v !== null && v !== undefined && v !== '');

if (cert.status === 'PASS') {
  if (!evidencePresent) failures.push('PASS requires complete evidence');
  if (!sha256.test(e.weights_manifest_sha256 ?? '')) failures.push('invalid weights manifest SHA-256');
  if (!sha256.test(e.audio_qa_report_sha256 ?? '')) failures.push('invalid audio QA report SHA-256');
  if (!sha256.test(e.provenance_manifest_sha256 ?? '')) failures.push('invalid provenance manifest SHA-256');
  if (!Array.isArray(e.loaded_weight_files) || e.loaded_weight_files.length === 0) failures.push('loaded weight files evidence required');
  if ((e.successful_generations ?? 0) < (r.minimum_successful_generations ?? 25)) failures.push('insufficient successful generations');
  if ((e.generation_error_rate ?? 1) > (r.maximum_generation_error_rate ?? 0.02)) failures.push('generation error rate above threshold');
  if ((e.p95_generation_seconds ?? Infinity) > (r.maximum_p95_generation_seconds ?? 120)) failures.push('p95 generation latency above threshold');
  if (e.deterministic_seed_match !== true) failures.push('deterministic generation test not verified');
  if (e.audio_qa_passed !== true) failures.push('audio QA not verified');
  if (!e.reviewer || Number.isNaN(Date.parse(e.reviewed_at ?? ''))) failures.push('valid reviewer approval required');
}

if (cert.status !== 'PASS' && cert.production_enabled !== false) failures.push('non-PASS certification must never enable production');

if (failures.length) {
  console.error('ACE-Step 1.5 production certification validation FAILED');
  failures.forEach((f) => console.error(`- ${f}`));
  process.exit(1);
}

console.log(`ACE-Step 1.5 production certification contract valid; status=${cert.status}`);
