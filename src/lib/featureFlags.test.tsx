import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const config = vi.hoisted(() => ({ local: true, supabaseUrl: 'https://placeholder.supabase.co', supabaseAnonKey: 'placeholder' }));
const query = vi.hoisted(() => vi.fn(async () => ({ data: [{ key: 'beta_agents', enabled: true }], error: null })));
vi.mock('./env', () => ({ env: config }));
vi.mock('./isLocalPreview', () => ({ isLocalPreviewHost: () => config.local }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: () => ({ select: () => ({ eq: query }) }) }) }));

beforeEach(() => {
  vi.resetModules();
  query.mockClear();
  config.local = true;
  config.supabaseUrl = 'https://placeholder.supabase.co';
  localStorage.clear();
});
afterEach(cleanup);

describe('Remote feature flag configuration', () => {
  it('uses defaults without network requests in the placeholder local preview', async () => {
    const { useFeatureFlag } = await import('./featureFlags');
    const { result } = renderHook(() => useFeatureFlag('beta_agents'));
    await act(async () => { await Promise.resolve(); });
    expect(result.current).toBe(false);
    expect(query).not.toHaveBeenCalled();
  });

  it('still fetches flags for a genuinely configured local preview', async () => {
    config.supabaseUrl = 'https://configured.supabase.co';
    const { useFeatureFlag } = await import('./featureFlags');
    const { result } = renderHook(() => useFeatureFlag('beta_agents'));
    await waitFor(() => expect(result.current).toBe(true));
    expect(query).toHaveBeenCalledOnce();
  });

  it('does not suppress remote configuration problems on public deployments', async () => {
    config.local = false;
    const { useFeatureFlag } = await import('./featureFlags');
    renderHook(() => useFeatureFlag('beta_agents'));
    await waitFor(() => expect(query).toHaveBeenCalledOnce());
  });
});
