import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('AI Therapy shadow reference producer end to end', () => {
  it('produces validated synthetic evidence without certifying behavior or enabling production', () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-therapy-shadow-reference-'));
    try {
      const completed = spawnSync(process.execPath, ['scripts/run-ai-therapy-shadow-reference-e2e.mjs'], {
        cwd: process.cwd(),
        env: { ...process.env, AI_THERAPY_SHADOW_REFERENCE_DIR: workDir },
        encoding: 'utf8',
      });

      expect(completed.status, completed.stderr || completed.stdout).toBe(0);
      const evidence = JSON.parse(fs.readFileSync(path.join(workDir, 'evidence.json'), 'utf8'));

      expect(evidence.certification_state).toBe('REVIEW_REQUIRED');
      expect(evidence.production_enabled).toBe(false);
      expect(evidence.user_facing).toBe(false);
      expect(evidence.synthetic_only).toBe(true);
      expect(evidence.model_provider_versions).toEqual(['synthetic-reference-producer-v1']);
      expect(Object.values(evidence.behavioral_evidence)).toEqual([
        false,
        false,
        false,
        false,
        false,
        false,
      ]);
      expect(evidence.results.failed).toBe(0);
      expect(evidence.results.p0_failures).toBe(0);
      expect(evidence.results.total).toBeGreaterThan(0);
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  });
});
