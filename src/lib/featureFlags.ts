/**
 * featureFlags.ts — D3VONN Feature Flag System
 *
 * Provides a lightweight, type-safe feature flag system backed by Supabase.
 * Flags can be toggled remotely without a code deployment.
 *
 * Architecture:
 *   1. Default values are defined in code (safe fallback if Supabase is down).
 *   2. Remote flags are fetched from the `feature_flags` Supabase table.
 *   3. Local overrides (localStorage) allow developers to test flags locally.
 *
 * Usage:
 *   import { useFeatureFlag } from '@/lib/featureFlags';
 *
 *   function MyComponent() {
 *     const isEnabled = useFeatureFlag('multi_agent_mesh');
 *     if (!isEnabled) return null;
 *     return <AgentMeshPanel />;
 *   }
 */

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// ── Flag Definitions ──────────────────────────────────────────────────────────

/**
 * Define all feature flags here with their default values.
 * Add new flags to this object before using them in components.
 */
export const FLAG_DEFAULTS = {
  multi_agent_mesh:        false,  // Enable the multi-agent mesh UI
  openclaw_bridge:         false,  // Enable OpenClaw code generation
  experimental_tools:      false,  // Show experimental tools in sidebar
  beta_agents:             false,  // Show beta agent types
  chaos_testing_ui:        false,  // Show chaos testing controls (internal only)
  cost_dashboard:          false,  // Show AWS cost dashboard
  supabase_realtime:       true,   // Use Supabase realtime subscriptions
  lighthouse_score_badge:  false,  // Show Lighthouse score badge in header
} as const;

export type FeatureFlagKey = keyof typeof FLAG_DEFAULTS;
export type FeatureFlags = Record<FeatureFlagKey, boolean>;

// ── Supabase Client ───────────────────────────────────────────────────────────

const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);

// ── Flag Resolution ───────────────────────────────────────────────────────────

const LOCAL_STORAGE_KEY = 'd3vonn_flag_overrides';

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
  // Trigger a storage event so other tabs update
  window.dispatchEvent(new Event('storage'));
}

export function clearLocalOverrides(): void {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}

async function fetchRemoteFlags(): Promise<Partial<FeatureFlags>> {
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

// ── React Hook ────────────────────────────────────────────────────────────────

let cachedFlags: FeatureFlags | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function resolveFlags(): Promise<FeatureFlags> {
  if (cachedFlags && Date.now() < cacheExpiry) {
    return cachedFlags;
  }

  const remote = await fetchRemoteFlags();
  const local = getLocalOverrides();

  // Priority: local overrides > remote flags > defaults
  cachedFlags = {
    ...FLAG_DEFAULTS,
    ...remote,
    ...local,
  } as FeatureFlags;
  cacheExpiry = Date.now() + CACHE_TTL_MS;

  return cachedFlags;
}

/**
 * Hook to check if a single feature flag is enabled.
 * Returns the default value immediately, then updates when remote flags load.
 */
export function useFeatureFlag(flag: FeatureFlagKey): boolean {
  const [value, setValue] = useState<boolean>(
    () => getLocalOverrides()[flag] ?? FLAG_DEFAULTS[flag]
  );

  useEffect(() => {
    let cancelled = false;
    resolveFlags().then((flags) => {
      if (!cancelled) setValue(flags[flag]);
    });

    // Re-check when local overrides change
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

/**
 * Hook to get all feature flags at once.
 */
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
