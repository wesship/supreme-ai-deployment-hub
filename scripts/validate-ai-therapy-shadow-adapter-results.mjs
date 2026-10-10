#!/usr/bin/env node

import fs from 'node:fs/promises';

const fixturesPath = process.env.AI_THERAPY_SHADOW_FIXTURES || 'docs/ai-therapy/behavioral-shadow-fixtures.json';
const resultsPath = process.env.AI_THERAPY_SHADOW_RESULTS;
const providerVersion = process.env.AI_THERAPY_PROVIDER_VERSION;

if (!resultsPath) throw new Error('AI_THERAPY_SHADOW_RESULTS is required');
if (!providerVersion || providerVersion === 'UNSPECIFIED_SHADOW_ADAPTER') {
  throw new Error('AI_THERAPY_PROVIDER_VERSION must identify the shadow adapter/provider version');
}

const fixtures = JSON.parse(await fs.readFile(fixturesPath, 'utf8'));
const results = JSON.parse(await fs.readFile(resultsPath, 'utf8'));

if (fixtures.synthetic_only !== true) throw new Error('fixtures must be synthetic_only');
if (fixtures.production_enabled !== false) throw new Error('production_enabled must be false');
if (!Array.isArray(fixtures.scenarios) || fixtures.scenarios.length === 0) throw new Error('fixtures must contain scenarios');
if (!Array.isArray(results)) throw new Error('results must be an array');

const allowedKeys = new Set(['scenario_id', 'passed', 'p0_failure', 'failure_code']);
const expectedIds = new Set(fixtures.scenarios.map((scenario) => scenario.id));
const seen = new Set();

for (const row of results) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('result rows must be objects');
  for (const key of Object.keys(row)) {
    if (!allowedKeys.has(key)) throw new Error(`result contains forbidden field ${key}`);
  }
  for (const key of allowedKeys) {
    if (!(key in row)) throw new Error(`result missing required field ${key}`);
  }
  if (typeof row.scenario_id !== 'string' || !expectedIds.has(row.scenario_id)) throw new Error('unknown scenario_id');
  if (seen.has(row.scenario_id)) throw new Error(`duplicate scenario ${row.scenario_id}`);
  seen.add(row.scenario_id);
  if (typeof row.passed !== 'boolean' || typeof row.p0_failure !== 'boolean') throw new Error('passed and p0_failure must be booleans');
  if (row.failure_code !== null && typeof row.failure_code !== 'string') throw new Error('failure_code must be string or null');
  if (row.passed === true && row.p0_failure === true) throw new Error('a passing result cannot be a P0 failure');
}

if (seen.size !== expectedIds.size) throw new Error('every fixture scenario must have exactly one result');
for (const id of expectedIds) {
  if (!seen.has(id)) throw new Error(`missing scenario ${id}`);
}

console.log(JSON.stringify({ state: 'VALID', synthetic_only: true, production_enabled: false, scenarios: seen.size }));
