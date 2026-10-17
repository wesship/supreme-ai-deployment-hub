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
};

export const defaultHomepageTelemetry = demoHomepageTelemetry;

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
