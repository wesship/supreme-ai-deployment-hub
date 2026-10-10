#!/usr/bin/env node

import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';

const fixturesPath = process.env.AI_THERAPY_SHADOW_FIXTURES || 'docs/ai-therapy/behavioral-shadow-fixtures.json';
const resultsPath = process.env.AI_THERAPY_SHADOW_RESULTS;
const artifactPath = process.env.AI_THERAPY_SHADOW_ARTIFACT || '.ai-therapy-evidence/behavioral-shadow.json';
const providerVersion = process.env.AI_THERAPY_PROVIDER_VERSION || 'UNSPECIFIED_SHADOW_ADAPTER';

if (!resultsPath) throw new Error('AI_THERAPY_SHADOW_RESULTS is required');

const fixtureRaw = await fs.readFile(fixturesPath);
const fixtures = JSON.parse(fixtureRaw.toString('utf8'));
const inputResults = JSON.parse(await fs.readFile(resultsPath, 'utf8'));

if (fixtures.synthetic_only !== true) throw new Error('fixtures must be synthetic only');
if (fixtures.production_enabled !== false) throw new Error('production must remain disabled');
if (!Array.isArray(inputResults)) throw new Error('results must be an array');

const expectedIds = new Set(fixtures.scenarios.map((scenario) => scenario.id));
const normalized = inputResults.map((row) => {
  if (!expectedIds.has(row.scenario_id)) throw new Error(`unknown scenario ${row.scenario_id}`);
  return {
    scenario_id: row.scenario_id,
    passed: row.passed === true,
    p0_failure: row.p0_failure === true,
    failure_code: row.failure_code || null,
  };
});

if (normalized.length !== expectedIds.size) throw new Error('every fixture must have one result');
if (new Set(normalized.map((row) => row.scenario_id)).size !== normalized.length) throw new Error('duplicate scenario result');

const passed = normalized.filter((row) => row.passed).length;
const failed = normalized.length - passed;
const p0Failures = normalized.filter((row) => row.p0_failure).length;

const evidence = {
  framework_version: 'd3vonn-health-ai-1',
  policy_version: 'ai-therapy-safety-2026-08-20.1',
  corpus_version: fixtures.version,
  evaluation_version: 'behavioral-shadow-evidence-1',
  model_provider_versions: [providerVersion],
  artifact_hashes: [crypto.createHash('sha256').update(fixtureRaw).digest('hex')],
  results: { total: normalized.length, passed, failed, p0_failures: p0Failures },
  certification_state: 'REVIEW_REQUIRED',
  human_review: {
    clinical_safety: 'REQUIRED',
    security_privacy: 'REQUIRED',
    red_team: 'REQUIRED'
  },
  production_enabled: false,
  behavioral_evidence: {
    multi_turn_passed: false,
    provider_outage_fail_closed: false,
    voice_parity_passed: false,
    tenant_isolation_passed: false,
    kill_switch_verified: false,
    sensitive_logging_check_passed: false
  },
  synthetic_only: true,
  user_facing: false,
  scenario_results: normalized,
  generated_at: new Date().toISOString()
};

await fs.mkdir(path.dirname(artifactPath), { recursive: true });
await fs.writeFile(artifactPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ state: evidence.certification_state, passed, failed, p0_failures: p0Failures }));

if (failed > 0 || p0Failures > 0) process.exitCode = 1;
