#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const fixturesPath = process.env.AI_THERAPY_SHADOW_FIXTURES || 'docs/ai-therapy/behavioral-shadow-fixtures.json';
const resultsPath = process.env.AI_THERAPY_SHADOW_RESULTS || '.ai-therapy-evidence/provider-results.json';
const adapterPath = process.env.AI_THERAPY_SHADOW_PROVIDER_MODULE;
const providerVersion = process.env.AI_THERAPY_PROVIDER_VERSION;
const timeoutMs = Number(process.env.AI_THERAPY_SHADOW_TIMEOUT_MS || '15000');

if (!adapterPath) throw new Error('AI_THERAPY_SHADOW_PROVIDER_MODULE is required');
if (!providerVersion || providerVersion === 'UNSPECIFIED_SHADOW_ADAPTER') throw new Error('AI_THERAPY_PROVIDER_VERSION is required');
if (!Number.isFinite(timeoutMs) || timeoutMs < 100 || timeoutMs > 60000) throw new Error('AI_THERAPY_SHADOW_TIMEOUT_MS must be between 100 and 60000');
if (process.env.AI_THERAPY_PRODUCTION_ENABLED === 'true') throw new Error('shadow provider runner refuses production-enabled mode');
if (process.env.AI_THERAPY_USER_FACING === 'true') throw new Error('shadow provider runner refuses user-facing mode');

const repoRoot = process.cwd();
const allowedRoot = path.resolve(repoRoot, 'scripts/ai-therapy/providers');
const resolvedAdapter = path.resolve(repoRoot, adapterPath);
if (!(resolvedAdapter === allowedRoot || resolvedAdapter.startsWith(`${allowedRoot}${path.sep}`))) {
  throw new Error('provider module must live under scripts/ai-therapy/providers');
}

const fixtures = JSON.parse(await fs.readFile(fixturesPath, 'utf8'));
if (fixtures.synthetic_only !== true) throw new Error('shadow provider runner requires synthetic_only fixtures');
if (fixtures.production_enabled !== false) throw new Error('shadow provider runner refuses production-enabled fixtures');
if (!Array.isArray(fixtures.scenarios) || fixtures.scenarios.length === 0) throw new Error('fixtures must contain scenarios');

const adapter = await import(pathToFileURL(resolvedAdapter).href);
if (typeof adapter.evaluateScenario !== 'function') throw new Error('provider module must export evaluateScenario');

const allowedKeys = new Set(['scenario_id', 'passed', 'p0_failure', 'failure_code']);
const results = [];

for (const scenario of fixtures.scenarios) {
  let raw;
  try {
    raw = await Promise.race([
      adapter.evaluateScenario(Object.freeze({
        id: scenario.id,
        category: scenario.category,
        severity: scenario.severity,
        turns: scenario.turns.map((turn) => Object.freeze({ ...turn })),
        expected: Object.freeze({ ...scenario.expected }),
        synthetic_only: true,
        production_enabled: false,
        user_facing: false,
        provider_version: providerVersion,
      })),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`provider timeout for ${scenario.id}`)), timeoutMs).unref?.();
      }),
    ]);
  } catch {
    raw = {
      scenario_id: scenario.id,
      passed: false,
      p0_failure: scenario.severity === 'P0',
      failure_code: 'SHADOW_PROVIDER_EXECUTION_FAILED',
    };
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`provider returned invalid result for ${scenario.id}`);
  for (const key of Object.keys(raw)) {
    if (!allowedKeys.has(key)) throw new Error(`provider returned forbidden field ${key}`);
  }
  if (raw.scenario_id !== scenario.id) throw new Error(`provider scenario_id mismatch for ${scenario.id}`);

  results.push({
    scenario_id: scenario.id,
    passed: raw.passed === true,
    p0_failure: raw.p0_failure === true,
    failure_code: raw.failure_code == null ? null : String(raw.failure_code),
  });
}

await fs.mkdir(path.dirname(resultsPath), { recursive: true });
await fs.writeFile(resultsPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ state: 'SHADOW_ONLY', synthetic_only: true, production_enabled: false, user_facing: false, scenarios: results.length }));

if (results.some((row) => !row.passed || row.p0_failure)) process.exitCode = 1;
