/**
 * featureFlags.ts — Devonn.AI Feature Flag System
 *
 * Provides a lightweight, type-safe feature flag system backed by Supabase.
 * Flags can be toggled remotely without a code deployment.
 *
 * Architecture:
 *   1. Default values are defined in code (safe fallback if Supabase is down).
 *   2. Remote flags are fetched from the `feature_flags` Supabase table.
 *   3. Local overrides (localStorage) allow developers to test flags locally.
 */

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { env } from './env';

export const FLAG_DEFAULTS = {
  multi_agent_mesh: false,
  openclaw_bridge: false,
  experimental_tools: false,
  beta_agents: false,
  chaos_testing_ui: false,
  cost_dashboard: false,
  supabase_realtime: true,
  lighthouse_score_badge: false,
  ai_film_companion: false,
} as const;

export type FeatureFlagKey = keyof typeof FLAG_DEFAULTS;
export type FeatureFlags = Record<FeatureFlagKey, boolean>;

const hasUsableSupabase = Boolean(
  env.supabaseUrl &&
  env.supabaseAnonKey &&
  !/^https?:\/\/(placeholder|example)(?:\.|\/|$)/i.test(env.supabaseUrl),
);

const supabase = hasUsableSupabase
  ? createClient(env.supabaseUrl, env.supabaseAnonKey)
  : null;

const LOCAL_STORAGE_KEY = 'devonn_flag_overrides';

function getLocalOverrides(): Partial<FeatureFlags> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setLocalOverride(flag: FeatureFlagKey, value: boolean): void {
  const overrides = getLocalOverrides();
  overrides[flag] = value;
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(overrides));
  window.dispatchEvent(new Event('storage'));
}

export function clearLocalOverrides(): void {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}

async function fetchRemoteFlags(): Promise<Partial<FeatureFlags>> {
  // Test/preview environments may intentionally use placeholder Supabase values.
  // Fall back to deterministic local defaults instead of making a doomed browser
  // request that produces CORS/runtime errors in E2E audits.
  if (!supabase) return {};

  try {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('key, enabled')
      .eq('active', true);

    if (error || !data) return {};

    return data.reduce<Partial<FeatureFlags>>((acc, row) => {
      if (row.key in FLAG_DEFAULTS) {
        acc[row.key as FeatureFlagKey] = row.enabled;
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
}

let cachedFlags: FeatureFlags | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function resolveFlags(): Promise<FeatureFlags> {
  if (cachedFlags && Date.now() < cacheExpiry) return cachedFlags;

  const remote = await fetchRemoteFlags();
  const local = getLocalOverrides();

  cachedFlags = {
    ...FLAG_DEFAULTS,
    ...remote,
    ...local,
  } as FeatureFlags;
  cacheExpiry = Date.now() + CACHE_TTL_MS;

  return cachedFlags;
}

export function useFeatureFlag(flag: FeatureFlagKey): boolean {
  const [value, setValue] = useState<boolean>(
    () => getLocalOverrides()[flag] ?? FLAG_DEFAULTS[flag],
  );

  useEffect(() => {
    let cancelled = false;
    resolveFlags().then((flags) => {
      if (!cancelled) setValue(flags[flag]);
    });

    const handleStorage = () => {
      const overrides = getLocalOverrides();
      if (flag in overrides) setValue(overrides[flag]!);
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      cancelled = true;
      window.removeEventListener('storage', handleStorage);
    };
  }, [flag]);

  return value;
}

export function useAllFeatureFlags(): FeatureFlags {
  const [flags, setFlags] = useState<FeatureFlags>({
    ...FLAG_DEFAULTS,
    ...getLocalOverrides(),
  } as FeatureFlags);

  useEffect(() => {
    let cancelled = false;
    resolveFlags().then((resolved) => {
      if (!cancelled) setFlags(resolved);
    });
    return () => { cancelled = true; };
  }, []);

  return flags;
}
