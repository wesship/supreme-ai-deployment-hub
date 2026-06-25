/**
 * usePublicStats — fetches live platform stats from the public API endpoint.
 * Falls back to sensible placeholder values if the API is unreachable.
 * Auto-refreshes every 60 seconds.
 */
import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.d3vonn.io';
const STATS_URL = `${API_BASE}/api/public/stats`;
const HEALTH_URL = `${API_BASE}/health`;
const REFRESH_INTERVAL = 60_000; // 60 seconds

export interface PlatformStats {
  activeAgents: number;
  completedWorkflows: number;
  uptimePercent: number;
  queuePending: number;
  totalTasksProcessed: number;
  latestEvents: Array<{
    agent_id: string;
    event_type: string;
    created_at: string;
    metadata?: Record<string, unknown>;
  }>;
  systemHealth: 'operational' | 'degraded' | 'down';
}

export interface PublicStatsResult {
  stats: PlatformStats;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
  isLive: boolean;
}

const FALLBACK_STATS: PlatformStats = {
  activeAgents: 24,
  completedWorkflows: 1847,
  uptimePercent: 99.9,
  queuePending: 3,
  totalTasksProcessed: 12_450,
  latestEvents: [],
  systemHealth: 'operational',
};

export function usePublicStats(): PublicStatsResult {
  const [stats, setStats] = useState<PlatformStats>(FALLBACK_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(STATS_URL, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();

      setStats({
        activeAgents: data.active_agents ?? FALLBACK_STATS.activeAgents,
        completedWorkflows: data.completed_workflows ?? FALLBACK_STATS.completedWorkflows,
        uptimePercent: data.uptime_percent ?? FALLBACK_STATS.uptimePercent,
        queuePending: data.queue_pending ?? FALLBACK_STATS.queuePending,
        totalTasksProcessed: data.total_tasks_processed ?? FALLBACK_STATS.totalTasksProcessed,
        latestEvents: data.latest_events ?? [],
        systemHealth: data.system_health ?? 'operational',
      });
      setIsLive(true);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      // Graceful fallback — use placeholder stats but mark as not live
      setIsLive(false);
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
      // Keep existing stats (either previous live data or fallback)
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return { stats, loading, error, lastUpdated, refresh: fetchStats, isLive };
}

/**
 * useSystemHealth — lightweight check against /health endpoint.
 */
export function useSystemHealth() {
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    const check = async () => {
      try {
        const resp = await fetch(HEALTH_URL, { method: 'GET' });
        if (resp.ok) {
          const data = await resp.json();
          setHealthy(true);
          setVersion(data.version || '');
        } else {
          setHealthy(false);
        }
      } catch {
        setHealthy(false);
      }
    };
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, []);

  return { healthy, version };
}
