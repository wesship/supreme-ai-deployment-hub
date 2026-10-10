import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const runner = path.join(root, 'scripts/run-ai-therapy-shadow-provider.mjs');
const adapter = 'scripts/ai-therapy/providers/synthetic-contract-adapter.mjs';
const fixtures = 'docs/ai-therapy/behavioral-shadow-fixtures.json';

function run(extraEnv: Record<string, string> = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-therapy-shadow-provider-'));
  const results = path.join(tmp, 'results.json');
  const proc = spawnSync(process.execPath, [runner], {
    cwd: root,
    env: {
      ...process.env,
      AI_THERAPY_SHADOW_FIXTURES: fixtures,
      AI_THERAPY_SHADOW_RESULTS: results,
      AI_THERAPY_SHADOW_PROVIDER_MODULE: adapter,
      AI_THERAPY_PROVIDER_VERSION: 'synthetic-contract-adapter@test',
      ...extraEnv,
    },
    encoding: 'utf8',
  });
  return { proc, results };
}

describe('AI Therapy isolated shadow provider runner', () => {
  it('runs synthetic fixtures through a repo-local adapter and emits only minimal result fields', () => {
    const { proc, results } = run();
    expect(proc.status).toBe(0);
    expect(proc.stderr).toBe('');
    expect(proc.stdout).toContain('"state":"SHADOW_ONLY"');
    expect(proc.stdout).toContain('"production_enabled":false');
    expect(proc.stdout).toContain('"user_facing":false');

    const rows = JSON.parse(fs.readFileSync(results, 'utf8'));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(['failure_code', 'p0_failure', 'passed', 'scenario_id']);
      expect(row.passed).toBe(true);
      expect(row.p0_failure).toBe(false);
      expect(row.failure_code).toBeNull();
    }
  });

  it('refuses production-enabled execution', () => {
    const { proc } = run({ AI_THERAPY_PRODUCTION_ENABLED: 'true' });
    expect(proc.status).not.toBe(0);
    expect(proc.stderr).toContain('refuses production-enabled mode');
  });

  it('refuses user-facing execution', () => {
    const { proc } = run({ AI_THERAPY_USER_FACING: 'true' });
    expect(proc.status).not.toBe(0);
    expect(proc.stderr).toContain('refuses user-facing mode');
  });

  it('refuses adapters outside the approved provider directory', () => {
    const { proc } = run({ AI_THERAPY_SHADOW_PROVIDER_MODULE: 'scripts/build-ai-therapy-shadow-evidence.mjs' });
    expect(proc.status).not.toBe(0);
    expect(proc.stderr).toContain('provider module must live under scripts/ai-therapy/providers');
  });
});
