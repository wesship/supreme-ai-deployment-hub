import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { usePublicStats } from '../usePublicStats';

afterEach(() => vi.unstubAllGlobals());

it('keeps unavailable metrics unknown instead of inventing healthy telemetry', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  const { result } = renderHook(() => usePublicStats());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.isLive).toBe(false);
  expect(result.current.stats.activeAgents).toBeNull();
  expect(result.current.stats.uptimePercent).toBeNull();
  expect(result.current.stats.systemHealth).toBe('unknown');
  expect(result.current.lastUpdated).toBeNull();
});

it('marks only complete fresh telemetry live and preserves a stale observation after failure', async () => {
  const payload = { active_agents: 3, completed_workflows: 7, queue_pending: 2,
    total_tasks_processed: 10, uptime_percent: null, system_health: 'unknown',
    telemetry_available: true, cached: false };
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
  vi.stubGlobal('fetch', fetcher);
  const { result } = renderHook(() => usePublicStats());
  await waitFor(() => expect(result.current.isLive).toBe(true));
  expect(result.current.stats.activeAgents).toBe(3);
  expect(result.current.stats.uptimePercent).toBeNull();
  fetcher.mockResolvedValue({ ok: true, json: async () => ({ ...payload, cached: true }) });
  await act(() => result.current.refresh());
  expect(result.current.isLive).toBe(false);
  fetcher.mockResolvedValue({ ok: true, json: async () => ({ ...payload, telemetry_available: false }) });
  await act(() => result.current.refresh());
  expect(result.current.isLive).toBe(false);
  fetcher.mockResolvedValue({ ok: false, status: 503 });
  await act(() => result.current.refresh());
  expect(result.current.error).toBe('API returned 503');
  expect(result.current.stats.activeAgents).toBe(3);
  expect(result.current.isLive).toBe(false);
});
