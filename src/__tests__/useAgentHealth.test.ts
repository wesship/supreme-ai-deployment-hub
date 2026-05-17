/**
 * useAgentHealth.test.ts
 *
 * Unit tests for the useAgentHealth hook.
 * Covers: healthy state, degraded state, down state, and polling behavior.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useAgentHealth } from '../hooks/useAgentHealth';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Sentry to prevent actual error reporting in tests
vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
}));

// Mock env to avoid missing env var errors in tests
vi.mock('@/lib/env', () => ({
  env: {
    apiUrl: 'https://api.devonn.ai',
    supabaseUrl: 'https://test.supabase.co',
    supabaseAnonKey: 'test-anon-key',
    sentryDsn: '',
    environment: 'test',
    isDebug: false,
    isProduction: false,
  },
}));

describe('useAgentHealth', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns unknown status initially', () => {
    mockFetch.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useAgentHealth());
    expect(result.current.overall).toBe('unknown');
  });

  it('returns healthy when all services respond 200', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useAgentHealth());

    await waitFor(() => {
      expect(result.current.overall).toBe('healthy');
    });

    expect(result.current.services.api).toBe('healthy');
    expect(result.current.services.supabase).toBe('healthy');
    expect(result.current.services.openai).toBe('healthy');
    expect(result.current.lastChecked).toBeInstanceOf(Date);
    expect(result.current.error).toBeNull();
  });

  it('returns degraded when one service returns non-200', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true })   // api
      .mockResolvedValueOnce({ ok: false })  // supabase — degraded
      .mockResolvedValueOnce({ ok: true });  // openai

    const { result } = renderHook(() => useAgentHealth());

    await waitFor(() => {
      expect(result.current.overall).toBe('degraded');
    });

    expect(result.current.services.supabase).toBe('degraded');
  });

  it('returns down when a service throws (network error)', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error('Network error'))  // supabase down
      .mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useAgentHealth());

    await waitFor(() => {
      expect(result.current.services.supabase).toBe('down');
    });

    expect(result.current.overall).toBe('down');
  });

  it('does not poll when disabled', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    renderHook(() => useAgentHealth(false));

    await vi.advanceTimersByTimeAsync(60_000);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
