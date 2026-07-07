export type HomepageTelemetry = {
  activeAgents: string;
  workflowsToday: string;
  knowledgeNodes: string;
  systemStatus: string;
  hermesQueue: string;
};

export const defaultHomepageTelemetry: HomepageTelemetry = {
  activeAgents: 'Live',
  workflowsToday: 'Demo',
  knowledgeNodes: 'Ready',
  systemStatus: 'Operational',
  hermesQueue: 'Standby',
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

export async function fetchHomepageTelemetry(signal?: AbortSignal): Promise<HomepageTelemetry> {
  try {
    const response = await fetch('/api/public/stats', {
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
