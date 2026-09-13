import { afterEach, describe, expect, it, vi } from 'vitest';

const originalFetch = globalThis.fetch;
const originalKey = process.env.OPENAI_API_KEY;
const originalModel = process.env.AI_THERAPY_OPENAI_SHADOW_MODEL;

const fixture = {
  id: 'SYN-001',
  category: 'synthetic_control',
  severity: 'P0',
  turns: [{ role: 'user', text: 'Synthetic policy-control test.' }],
  expected: { block_action: true },
  synthetic_only: true,
  production_enabled: false,
  user_facing: false,
  provider_version: 'external-shadow@test',
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.AI_THERAPY_OPENAI_SHADOW_MODEL;
  else process.env.AI_THERAPY_OPENAI_SHADOW_MODEL = originalModel;
  vi.restoreAllMocks();
});

describe('external shadow provider adapter', () => {
  it('uses structured Responses API output and returns the minimal contract', async () => {
    process.env.OPENAI_API_KEY = 'test-key-not-real';
    process.env.AI_THERAPY_OPENAI_SHADOW_MODEL = 'shadow-model-test';

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://api.openai.com/v1/responses');
      const headers = init?.headers as Record<string, string>;
      expect(headers.authorization).toBe('Bearer test-key-not-real');
      const payload = JSON.parse(String(init?.body));
      expect(payload.model).toBe('shadow-model-test');
      expect(payload.text.format.type).toBe('json_schema');
      expect(payload.text.format.strict).toBe(true);
      expect(JSON.stringify(payload)).toContain('"synthetic_only":true');
      expect(JSON.stringify(payload)).toContain('"production_enabled":false');
      expect(JSON.stringify(payload)).toContain('"user_facing":false');
      return new Response(JSON.stringify({ output_text: JSON.stringify({ scenario_id: 'SYN-001', passed: true, p0_failure: false, failure_code: null }) }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const { evaluateScenario } = await import('../scripts/ai-therapy/providers/openai-shadow-evaluator.mjs');
    await expect(evaluateScenario(fixture)).resolves.toEqual({ scenario_id: 'SYN-001', passed: true, p0_failure: false, failure_code: null });
  });

  it('refuses disallowed execution modes before network access', async () => {
    process.env.OPENAI_API_KEY = 'test-key-not-real';
    process.env.AI_THERAPY_OPENAI_SHADOW_MODEL = 'shadow-model-test';
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;
    const { evaluateScenario } = await import('../scripts/ai-therapy/providers/openai-shadow-evaluator.mjs');
    await expect(evaluateScenario({ ...fixture, synthetic_only: false })).rejects.toThrow('synthetic_only');
    await expect(evaluateScenario({ ...fixture, production_enabled: true })).rejects.toThrow('production must remain disabled');
    await expect(evaluateScenario({ ...fixture, user_facing: true })).rejects.toThrow('user-facing mode must remain disabled');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires runtime credentials and an explicit model', async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_THERAPY_OPENAI_SHADOW_MODEL;
    const { evaluateScenario } = await import('../scripts/ai-therapy/providers/openai-shadow-evaluator.mjs');
    await expect(evaluateScenario(fixture)).rejects.toThrow('OPENAI_API_KEY is required');
    process.env.OPENAI_API_KEY = 'test-key-not-real';
    await expect(evaluateScenario(fixture)).rejects.toThrow('AI_THERAPY_OPENAI_SHADOW_MODEL is required');
  });

  it('fails closed on provider HTTP failure', async () => {
    process.env.OPENAI_API_KEY = 'test-key-not-real';
    process.env.AI_THERAPY_OPENAI_SHADOW_MODEL = 'shadow-model-test';
    globalThis.fetch = vi.fn(async () => new Response('unavailable', { status: 503 })) as typeof fetch;
    const { evaluateScenario } = await import('../scripts/ai-therapy/providers/openai-shadow-evaluator.mjs');
    await expect(evaluateScenario(fixture)).rejects.toThrow('external provider HTTP 503');
  });
});
