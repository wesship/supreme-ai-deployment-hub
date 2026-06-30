/**
 * useAgentHealth.ts — Centralised agent mesh health monitoring hook
 *
 * Replaces the scattered health check logic duplicated across:
 *   - background.js (Chrome extension)
 *   - run_d3vonn_ai.py (D3VONN Python orchestrator)
 *   - d3vonn_mesh_health.py (Phase 7 script)
 *
 * This hook provides a single React-based health status that any component
 * can subscribe to, with automatic polling and Sentry error capture.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Sentry from '@sentry/react';
import { env } from '@/lib/env';

export type ServiceStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

export interface AgentHealthStatus {
  overall: ServiceStatus;
  services: {
    api: ServiceStatus;
    supabase: ServiceStatus;
    openai: ServiceStatus;
  };
  lastChecked: Date | null;
  isChecking: boolean;
  error: string | null;
}

const POLL_INTERVAL_MS = 30_000; // 30 seconds
const REQUEST_TIMEOUT_MS = 8_000;

async function checkEndpoint(url: string): Promise<ServiceStatus> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response.ok ? 'healthy' : 'degraded';
  } catch {
    clearTimeout(timeoutId);
    return 'down';
  }
}

function computeOverall(services: AgentHealthStatus['services']): ServiceStatus {
  const statuses = Object.values(services);
  if (statuses.every((s) => s === 'healthy')) return 'healthy';
  if (statuses.some((s) => s === 'down')) return 'down';
  return 'degraded';
}

export function useAgentHealth(enabled = true): AgentHealthStatus {
  const [status, setStatus] = useState<AgentHealthStatus>({
    overall: 'unknown',
    services: { api: 'unknown', supabase: 'unknown', openai: 'unknown' },
    lastChecked: null,
    isChecking: false,
    error: null,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async () => {
    setStatus((prev) => ({ ...prev, isChecking: true, error: null }));
    try {
      const [api, supabase, openai] = await Promise.all([
        checkEndpoint(`${env.apiUrl}/status/health`),
        checkEndpoint(`${env.supabaseUrl}/rest/v1/`),
        checkEndpoint('https://api.openai.com/v1/models'),
      ]);
      const services = { api, supabase, openai };
      setStatus({
        overall: computeOverall(services),
        services,
        lastChecked: new Date(),
        isChecking: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      Sentry.captureException(err, { tags: { hook: 'useAgentHealth' } });
      setStatus((prev) => ({
        ...prev,
        overall: 'down',
        isChecking: false,
        error: message,
      }));
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    check();
    intervalRef.current = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, check]);

  return status;
}
