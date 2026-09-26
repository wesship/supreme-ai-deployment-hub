import { describe, expect, it } from 'vitest';
import { deriveLiveExecutionPanels } from './livePanels';
import type { HermesStreamEvent } from '../hooks/useHermesEvents';

const event = (overrides: Partial<HermesStreamEvent>): HermesStreamEvent => ({
  id: 'evt-1',
  type: 'task.running',
  message: 'Hermes execution running',
  level: 'info',
  correlationId: 'corr-1',
  timestamp: '2026-09-26T22:00:00Z',
  data: {},
  ...overrides,
});

describe('deriveLiveExecutionPanels', () => {
  it('keeps unreported cost and usage metrics null', () => {
    const result = deriveLiveExecutionPanels([event({})], 'live');

    expect(result.status).toBe('running');
    expect(result.costUsd).toBeNull();
    expect(result.tokensUsed).toBeNull();
    expect(result.durationMs).toBeNull();
  });

  it('aggregates event-reported metrics and agent activity', () => {
    const result = deriveLiveExecutionPanels([
      event({
        id: 'evt-1',
        agentName: 'research-agent',
        data: { cost_usd: 0.02, tokens_used: 100, duration_ms: 500, provider: 'Supabase' },
      }),
      event({
        id: 'evt-2',
        type: 'tool.completed',
        message: 'Redis lookup completed',
        agentName: 'research-agent',
        timestamp: '2026-09-26T22:00:01Z',
        data: { cost_usd: 0.03, tokens_used: 50, duration_ms: 250 },
      }),
    ], 'live');

    expect(result.costUsd).toBeCloseTo(0.05);
    expect(result.tokensUsed).toBe(150);
    expect(result.durationMs).toBe(750);
    expect(result.agents[0]).toMatchObject({ name: 'research-agent', events: 2 });
    expect(result.infrastructure.map((item) => item.name)).toEqual(
      expect.arrayContaining(['Supabase', 'Redis']),
    );
    expect(result.asOf).toBe('2026-09-26T22:00:01Z');
  });

  it('marks failed and completed terminal states from Hermes lifecycle events', () => {
    const failed = deriveLiveExecutionPanels([
      event({ type: 'task.failed', level: 'error' }),
    ], 'live');
    expect(failed.status).toBe('failed');

    const complete = deriveLiveExecutionPanels([
      event({ type: 'task.completed', message: 'Task completed' }),
    ], 'live');
    expect(complete.status).toBe('complete');
  });

  it('shows connecting before the first event arrives', () => {
    expect(deriveLiveExecutionPanels([], 'connecting').status).toBe('connecting');
    expect(deriveLiveExecutionPanels([], 'idle').status).toBe('idle');
  });
});
