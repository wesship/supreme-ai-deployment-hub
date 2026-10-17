import { supabase } from '@/integrations/supabase/client';

export type TelemetrySource = 'live' | 'demo';

export type HomepageTelemetry = {
  source: TelemetrySource;
  activeAgents: string;
  activeGoals: string;
  tasksCompleted: string;
  tasksRunning: string;
  hermesQueue: string;
  systemStatus: string;
  lastActivityAt: string | null;
  /** Legacy aliases used by older homepage variants. */
  workflowsCompleted: string;
  tasksProcessed: string;
};

/** Illustrative values shown (and labelled "Demo data") when live Hermes stats are unavailable. */
export const demoHomepageTelemetry: HomepageTelemetry = {
  source: 'demo',
  activeAgents: '12',
  activeGoals: '4',
  tasksCompleted: '1,284',
  tasksRunning: '7',
  hermesQueue: '3',
  systemStatus: 'Unknown',
  lastActivityAt: null,
  workflowsCompleted: '1,284',
  tasksProcessed: '1,284',
};

/** Neutral placeholder used before the first fetch resolves (still flagged as non-live). */
export const defaultHomepageTelemetry: HomepageTelemetry = {
  source: 'demo',
  activeAgents: 'Not reported',
  activeGoals: 'Not reported',
  tasksCompleted: 'Not reported',
  tasksRunning: 'Not reported',
  hermesQueue: 'Not reported',
  systemStatus: 'Unknown',
  lastActivityAt: null,
  workflowsCompleted: 'Not reported',
  tasksProcessed: 'Not reported',
};

type PublicStatsResponse = {
  active_agents?: number | string | null;
  completed_workflows?: number | string | null;
  queue_pending?: number | string | null;
  total_tasks_processed?: number | string | null;
  system_health?: string;
};
const fmt = (v: unknown, f: string) =>
  typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString() : typeof v === 'string' && v.trim() ? v : f;

/** Legacy mapping for the external public stats API shape. */
export const normalizePublicStats = (stats: PublicStatsResponse | null | undefined): HomepageTelemetry => {
  const d = defaultHomepageTelemetry;
  if (!stats) return d;
  return {
    ...d,
    activeAgents: fmt(stats.active_agents, d.activeAgents),
    workflowsCompleted: fmt(stats.completed_workflows, d.workflowsCompleted),
    tasksProcessed: fmt(stats.total_tasks_processed, d.tasksProcessed),
    systemStatus: stats.system_health || d.systemStatus,
    hermesQueue: fmt(stats.queue_pending, d.hermesQueue),
  };
};

type HermesStats = {
  active_agents?: number | null;
  active_goals?: number | null;
  tasks_completed?: number | null;
  tasks_running?: number | null;
  queue_pending?: number | null;
  last_activity_at?: string | null;
};

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** Returns live telemetry only when every count is a real number; otherwise demo data. */
export const normalizeHermesStats = (stats: HermesStats | null | undefined): HomepageTelemetry => {
  if (!stats) return demoHomepageTelemetry;
  const counts = [stats.active_agents, stats.active_goals, stats.tasks_completed, stats.tasks_running, stats.queue_pending];
  if (!counts.every(isCount)) return demoHomepageTelemetry;
  const [agents, goals, done, running, queue] = counts as number[];
  return {
    source: 'live',
    activeAgents: agents.toLocaleString(),
    activeGoals: goals.toLocaleString(),
    tasksCompleted: done.toLocaleString(),
    tasksRunning: running.toLocaleString(),
    hermesQueue: queue.toLocaleString(),
    systemStatus: 'Operational',
    lastActivityAt: stats.last_activity_at ?? null,
    workflowsCompleted: done.toLocaleString(),
    tasksProcessed: done.toLocaleString(),
  };
};

export async function fetchHomepageTelemetry(signal?: AbortSignal): Promise<HomepageTelemetry> {
  try {
    const { data, error } = await supabase.rpc('get_hermes_public_stats').abortSignal(signal as AbortSignal);
    if (error || signal?.aborted) return demoHomepageTelemetry;
    return normalizeHermesStats(data as HermesStats);
  } catch {
    return demoHomepageTelemetry;
  }
}
