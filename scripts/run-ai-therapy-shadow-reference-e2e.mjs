#!/usr/bin/env node

import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const workDir = process.env.AI_THERAPY_SHADOW_REFERENCE_DIR || '.ai-therapy-evidence/reference-e2e';
const subsetPath = path.join(workDir, 'fixtures.json');
const resultsPath = path.join(workDir, 'results.json');
const artifactPath = path.join(workDir, 'evidence.json');
const providerVersion = 'synthetic-reference-producer-v1';

await fs.mkdir(workDir, { recursive: true });

function run(script, extraEnv = {}) {
  const completed = spawnSync(process.execPath, [script], {
    cwd: root,
    env: { ...process.env, ...extraEnv },
    encoding: 'utf8',
  });
  if (completed.status !== 0) {
    const details = [completed.stdout, completed.stderr].filter(Boolean).join('\n');
    throw new Error(`${script} failed\n${details}`);
  }
}

run('scripts/produce-ai-therapy-shadow-reference-results.mjs', {
  AI_THERAPY_SHADOW_REFERENCE_FIXTURES: subsetPath,
  AI_THERAPY_SHADOW_RESULTS: resultsPath,
});

const shared = {
  AI_THERAPY_SHADOW_FIXTURES: subsetPath,
  AI_THERAPY_SHADOW_RESULTS: resultsPath,
  AI_THERAPY_PROVIDER_VERSION: providerVersion,
};

run('scripts/validate-ai-therapy-shadow-adapter-results.mjs', shared);
run('scripts/build-ai-therapy-shadow-evidence.mjs', {
  ...shared,
  AI_THERAPY_SHADOW_ARTIFACT: artifactPath,
});

const evidence = JSON.parse(await fs.readFile(artifactPath, 'utf8'));
if (evidence.certification_state !== 'REVIEW_REQUIRED') throw new Error('reference run must remain review-required');
if (evidence.production_enabled !== false) throw new Error('reference run must keep production disabled');
if (evidence.user_facing !== false) throw new Error('reference run must not be user-facing');
if (evidence.synthetic_only !== true) throw new Error('reference run must remain synthetic-only');
if (evidence.model_provider_versions?.[0] !== providerVersion) throw new Error('reference provider identity mismatch');
if (Object.values(evidence.behavioral_evidence || {}).some((value) => value !== false)) {
  throw new Error('reference simulation cannot satisfy behavioral certification flags');
}

console.log(JSON.stringify({
  state: 'REFERENCE_E2E_PASS',
  certification_state: evidence.certification_state,
  production_enabled: evidence.production_enabled,
  scenarios: evidence.results?.total,
}));
