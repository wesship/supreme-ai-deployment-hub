import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('AI Therapy shadow adapter boundary', () => {
  it('keeps the adapter non-production and review-required', () => {
    const contract = read('docs/ai-therapy/SHADOW_ADAPTER_CONTRACT.md');
    expect(contract).toContain('production_enabled` is always `false`');
    expect(contract).toContain('user_facing` is always `false`');
    expect(contract).toContain('REVIEW_REQUIRED');
    expect(contract).toContain('No real user data');
  });

  it('permits only the minimal result record fields', () => {
    const schema = JSON.parse(read('docs/ai-therapy/SHADOW_ADAPTER_RESULT.schema.json'));
    expect(schema.type).toBe('array');
    expect(schema.items.additionalProperties).toBe(false);
    expect(schema.items.required).toEqual(['scenario_id', 'passed', 'p0_failure', 'failure_code']);
    expect(Object.keys(schema.items.properties).sort()).toEqual(['failure_code', 'p0_failure', 'passed', 'scenario_id']);
  });

  it('validator fails closed on provider, fixture, and completeness boundaries', () => {
    const validator = read('scripts/validate-ai-therapy-shadow-adapter-results.mjs');
    expect(validator).toContain('AI_THERAPY_PROVIDER_VERSION');
    expect(validator).toContain('synthetic_only !== true');
    expect(validator).toContain('production_enabled !== false');
    expect(validator).toContain('forbidden field');
    expect(validator).toContain('duplicate scenario');
    expect(validator).toContain('every fixture scenario must have exactly one result');
  });
});
