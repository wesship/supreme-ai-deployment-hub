export type HomepageTelemetry = {
  activeAgents: string;
  workflowsToday: string;
  knowledgeNodes: string;
  systemStatus: string;
  hermesQueue: string;
};

export const defaultHomepageTelemetry: HomepageTelemetry = {
  activeAgents: 'Not reported',
  workflowsToday: 'Not reported',
  knowledgeNodes: 'Not reported',
  systemStatus: 'Unknown',
  hermesQueue: 'Not reported',
};

type PublicStatsResponse = {
  active_agents?: number | string;
  completed_workflows?: number | string;
  uptime_percent?: number | string;
  queue_pending?: number | string;
  total_tasks_processed?: number | string;
  system_health?: string;
};

const formatNumber = (value: unknown, fallback: string): string => {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toLocaleString();
  if (typeof value === 'string' && value.trim()) return value;
  return fallback;
};

export const normalizePublicStats = (stats: PublicStatsResponse | null | undefined): HomepageTelemetry => {
  if (!stats) return defaultHomepageTelemetry;

  return {
    activeAgents: formatNumber(stats.active_agents, defaultHomepageTelemetry.activeAgents),
    workflowsToday: formatNumber(stats.completed_workflows, defaultHomepageTelemetry.workflowsToday),
    knowledgeNodes: formatNumber(stats.total_tasks_processed, defaultHomepageTelemetry.knowledgeNodes),
    systemStatus: stats.system_health || defaultHomepageTelemetry.systemStatus,
    hermesQueue: formatNumber(stats.queue_pending, defaultHomepageTelemetry.hermesQueue),
  };
};

const isLocalPreviewHost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
};

const getPublicStatsUrl = (): string => {
  const configuredBase = import.meta.env.VITE_API_URL?.trim();
  const apiBase = configuredBase || 'https://api.d3vonn.io';
  return `${apiBase.replace(/\/$/, '')}/api/public/stats`;
};

export async function fetchHomepageTelemetry(signal?: AbortSignal): Promise<HomepageTelemetry> {
  // Local preview and CI hosts intentionally avoid calling the production API.
  // This prevents cross-origin console failures while keeping production telemetry live.
  if (isLocalPreviewHost()) return defaultHomepageTelemetry;

  try {
    const response = await fetch(getPublicStatsUrl(), {
      signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) return defaultHomepageTelemetry;

    const payload = (await response.json()) as PublicStatsResponse;
    return normalizePublicStats(payload);
  } catch {
    return defaultHomepageTelemetry;
  }
}
