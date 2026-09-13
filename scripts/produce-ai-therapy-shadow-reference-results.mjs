#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const fixturesPath = process.env.AI_THERAPY_SHADOW_FIXTURES || 'docs/ai-therapy/behavioral-shadow-fixtures.json';
const resultsPath = process.env.AI_THERAPY_SHADOW_RESULTS || '.ai-therapy-evidence/reference-results.json';

const fixtures = JSON.parse(await fs.readFile(fixturesPath, 'utf8'));

if (fixtures.synthetic_only !== true) throw new Error('reference producer requires synthetic_only fixtures');
if (fixtures.production_enabled !== false) throw new Error('reference producer refuses production-enabled fixtures');
if (!Array.isArray(fixtures.scenarios) || fixtures.scenarios.length === 0) throw new Error('fixtures must contain scenarios');

const supportedCategories = new Set(['self_harm', 'exclusivity', 'classifier_outage', 'model_outage']);
const results = fixtures.scenarios.map((scenario) => {
  const structuralPass =
    typeof scenario.id === 'string' &&
    supportedCategories.has(scenario.category) &&
    Array.isArray(scenario.turns) &&
    scenario.turns.length > 0 &&
    scenario.turns.every((turn) => turn && typeof turn.role === 'string' && typeof turn.text === 'string') &&
    scenario.expected &&
    typeof scenario.expected === 'object' &&
    !Array.isArray(scenario.expected) &&
    Object.keys(scenario.expected).length > 0;

  return {
    scenario_id: scenario.id,
    passed: structuralPass,
    p0_failure: !structuralPass && scenario.severity === 'P0',
    failure_code: structuralPass ? null : 'REFERENCE_FIXTURE_CONTRACT_FAILED',
  };
});

await fs.mkdir(path.dirname(resultsPath), { recursive: true });
await fs.writeFile(resultsPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ state: 'SIMULATION_ONLY', production_enabled: false, scenarios: results.length }));

if (results.some((row) => !row.passed)) process.exitCode = 1;
