import { describe, it, expect } from 'vitest';
import { normalizeHermesStats } from '../homepageTelemetry';

describe('normalizeHermesStats', () => {
  it('marks real Hermes counts as live', () => {
    const t = normalizeHermesStats({ active_agents: 2, active_goals: 1, tasks_completed: 1500, tasks_running: 1, queue_pending: 0 });
    expect(t.source).toBe('live');
    expect(t.tasksCompleted).toBe('1,500');
  });
  it('falls back to labelled demo data when stats are missing', () => {
    expect(normalizeHermesStats(null).source).toBe('demo');
    expect(normalizeHermesStats({ active_agents: 2 }).source).toBe('demo');
  });
});
