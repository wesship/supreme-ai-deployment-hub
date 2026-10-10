import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const fixturesPath = path.resolve('docs/ai-therapy/behavioral-shadow-fixtures.json');
const builderPath = path.resolve('scripts/build-ai-therapy-shadow-evidence.mjs');

describe('AI Therapy behavioral shadow evidence builder', () => {
  it('produces REVIEW_REQUIRED evidence and never enables production', async () => {
    const fixtures = JSON.parse(await readFile(fixturesPath, 'utf8'));
    const dir = await mkdtemp(path.join(tmpdir(), 'ai-therapy-shadow-'));
    const resultsPath = path.join(dir, 'results.json');
    const artifactPath = path.join(dir, 'evidence.json');

    await writeFile(
      resultsPath,
      JSON.stringify(fixtures.scenarios.map((scenario: { id: string }) => ({
        scenario_id: scenario.id,
        passed: true,
        p0_failure: false,
        failure_code: null,
      }))),
      'utf8',
    );

    const run = spawnSync(process.execPath, [builderPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        AI_THERAPY_SHADOW_FIXTURES: fixturesPath,
        AI_THERAPY_SHADOW_RESULTS: resultsPath,
        AI_THERAPY_SHADOW_ARTIFACT: artifactPath,
        AI_THERAPY_PROVIDER_VERSION: 'synthetic-adapter-test',
      },
      encoding: 'utf8',
    });

    expect(run.status).toBe(0);
    const evidence = JSON.parse(await readFile(artifactPath, 'utf8'));
    expect(evidence.certification_state).toBe('REVIEW_REQUIRED');
    expect(evidence.production_enabled).toBe(false);
    expect(evidence.synthetic_only).toBe(true);
    expect(evidence.user_facing).toBe(false);
    expect(evidence.results.failed).toBe(0);
    expect(evidence.human_review.clinical_safety).toBe('REQUIRED');
    expect(evidence.behavioral_evidence.multi_turn_passed).toBe(false);
    expect(evidence.behavioral_evidence.tenant_isolation_passed).toBe(false);
    expect(evidence.behavioral_evidence.kill_switch_verified).toBe(false);
  });

  it('fails closed when a P0 result fails', async () => {
    const fixtures = JSON.parse(await readFile(fixturesPath, 'utf8'));
    const dir = await mkdtemp(path.join(tmpdir(), 'ai-therapy-shadow-fail-'));
    const resultsPath = path.join(dir, 'results.json');
    const artifactPath = path.join(dir, 'evidence.json');

    await writeFile(
      resultsPath,
      JSON.stringify(fixtures.scenarios.map((scenario: { id: string }, index: number) => ({
        scenario_id: scenario.id,
        passed: index !== 0,
        p0_failure: index === 0,
        failure_code: index === 0 ? 'SYNTHETIC_P0_FAILURE' : null,
      }))),
      'utf8',
    );

    const run = spawnSync(process.execPath, [builderPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        AI_THERAPY_SHADOW_FIXTURES: fixturesPath,
        AI_THERAPY_SHADOW_RESULTS: resultsPath,
        AI_THERAPY_SHADOW_ARTIFACT: artifactPath,
      },
      encoding: 'utf8',
    });

    expect(run.status).not.toBe(0);
    const evidence = JSON.parse(await readFile(artifactPath, 'utf8'));
    expect(evidence.certification_state).toBe('REVIEW_REQUIRED');
    expect(evidence.production_enabled).toBe(false);
    expect(evidence.results.p0_failures).toBe(1);
  });
});
