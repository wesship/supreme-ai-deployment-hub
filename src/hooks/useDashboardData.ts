import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServiceHealth } from "@/hooks/useServiceHealth";

export interface DashboardAgent {
  id: string;
  name: string;
  status: string;
  pct: number;
  tag: string;
}

export interface DashboardWorkflow {
  id: string;
  name: string;
  runs: number;
  status: "Healthy" | "Queued" | "Failed";
}

export interface DashboardStats {
  activeAgents: number;
  activeAgentsTrend: string;
  tasksCompleted: number;
  tasksCompletedTrend: string;
  workflowsRunning: number;
  workflowsTrend: string;
  systemHealthPct: number;
  systemHealthLabel: string;
}

export interface DashboardActivity {
  id: string;
  agent_name: string | null;
  event_type: string;
  status: string | null;
  created_at: string;
}

const MOCK_AGENTS: DashboardAgent[] = [
  { id: "m1", name: "Atlas Researcher", status: "Synthesizing", pct: 72, tag: "Knowledge" },
  { id: "m2", name: "Helios Sales", status: "Dispatching", pct: 46, tag: "Revenue" },
  { id: "m3", name: "Vault Sentinel", status: "Scanning", pct: 91, tag: "Security" },
  { id: "m4", name: "Forge Engineer", status: "Deploying", pct: 33, tag: "Engineering" },
];

const MOCK_WORKFLOWS: DashboardWorkflow[] = [
  { id: "w1", name: "Daily intel digest", runs: 142, status: "Healthy" },
  { id: "w2", name: "Lead enrichment", runs: 88, status: "Healthy" },
  { id: "w3", name: "Security sweep", runs: 56, status: "Healthy" },
  { id: "w4", name: "Release deploy", runs: 12, status: "Queued" },
];

function pctFromHealth(score: number | null | undefined, status: string | null | undefined): number {
  if (typeof score === "number" && score > 0) return Math.round(score > 1 ? score : score * 100);
  if (status === "active" || status === "running" || status === "healthy") return 85;
  if (status === "deploying") return 40;
  if (status === "stopped" || status === "failed") return 10;
  return 50;
}

export function useDashboardData() {
  const { statuses, isChecking, checkAll } = useServiceHealth();

  const [agents, setAgents] = useState<DashboardAgent[]>([]);
  const [workflows, setWorkflows] = useState<DashboardWorkflow[]>([]);
  const [activity, setActivity] = useState<DashboardActivity[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    activeAgents: 0,
    activeAgentsTrend: "",
    tasksCompleted: 0,
    tasksCompletedTrend: "",
    workflowsRunning: 0,
    workflowsTrend: "",
    systemHealthPct: 0,
    systemHealthLabel: "Checking",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [agentsRes, wfRes, runsRes, activityRes] = await Promise.all([
        (supabase as any)
          .from("deployed_agents")
          .select("id,name,status,health_score,total_runs,successful_runs,failed_runs,config")
          .order("deployed_at", { ascending: false })
          .limit(50),
        (supabase as any)
          .from("workflows")
          .select("id,name,executor")
          .order("updated_at", { ascending: false })
          .limit(20),
        (supabase as any)
          .from("workflow_runs")
          .select("id,workflow_id,status,started_at")
          .gte("started_at", new Date(Date.now() - 86_400_000).toISOString())
          .limit(1000),
        (supabase as any)
          .from("agent_activity_logs")
          .select("id,agent_name,event_type,status,created_at")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      const firstErr =
        agentsRes.error || wfRes.error || runsRes.error || activityRes.error;
      if (firstErr) throw firstErr;

      const agentRows = agentsRes.data ?? [];
      const wfRows = wfRes.data ?? [];
      const runRows = runsRes.data ?? [];
      const activityRows = activityRes.data ?? [];

      const hasRealData =
        agentRows.length > 0 || wfRows.length > 0 || activityRows.length > 0;

      let resolvedAgents: DashboardAgent[];
      let resolvedWorkflows: DashboardWorkflow[];

      if (hasRealData) {
        setUsingMock(false);
        resolvedAgents = agentRows.slice(0, 8).map((a: any) => {
          const cfg = (a.config && typeof a.config === "object") ? a.config : {};
          return {
            id: a.id,
            name: a.name ?? "Unnamed agent",
            status: a.status ?? "idle",
            pct: pctFromHealth(a.health_score, a.status),
            tag: (cfg.category as string) ?? (cfg.tag as string) ?? "Agent",
          };
        });

        const runCounts = new Map<string, number>();
        const failedCounts = new Map<string, number>();
        runRows.forEach((r: any) => {
          if (!r.workflow_id) return;
          runCounts.set(r.workflow_id, (runCounts.get(r.workflow_id) ?? 0) + 1);
          if (r.status === "failed")
            failedCounts.set(r.workflow_id, (failedCounts.get(r.workflow_id) ?? 0) + 1);
        });
        resolvedWorkflows = wfRows.slice(0, 8).map((w: any) => ({
          id: w.id,
          name: w.name ?? "Untitled workflow",
          runs: runCounts.get(w.id) ?? 0,
          status: (failedCounts.get(w.id) ?? 0) > 0
            ? "Failed"
            : (runCounts.get(w.id) ?? 0) > 0
            ? "Healthy"
            : "Queued",
        }));
      } else {
        setUsingMock(true);
        resolvedAgents = MOCK_AGENTS;
        resolvedWorkflows = MOCK_WORKFLOWS;
      }

      setAgents(resolvedAgents);
      setWorkflows(resolvedWorkflows);
      setActivity(activityRows);

      const activeAgents = hasRealData
        ? agentRows.filter((a: any) => ["active", "running", "deploying"].includes(a.status)).length
        : resolvedAgents.length;
      const tasksCompleted = hasRealData
        ? agentRows.reduce((s: number, a: any) => s + (a.successful_runs ?? 0), 0) +
          runRows.filter((r: any) => r.status === "completed").length
        : 1284;
      const tasksLast24h = runRows.filter(
        (r: any) => r.status === "completed",
      ).length;
      const errorsLast24h = runRows.filter((r: any) => r.status === "failed").length;
      const workflowsRunning = hasRealData
        ? resolvedWorkflows.filter((w) => w.status !== "Queued").length
        : 9;

      setStats({
        activeAgents,
        activeAgentsTrend: hasRealData ? `${agentRows.length} total` : "+3 today",
        tasksCompleted,
        tasksCompletedTrend: hasRealData ? `+${tasksLast24h} / 24h` : "+128 / 24h",
        workflowsRunning,
        workflowsTrend: hasRealData ? `${errorsLast24h} errors` : "0 errors",
        systemHealthPct: 0,
        systemHealthLabel: "Checking",
      });
    } catch (e: any) {
      console.error("[useDashboardData] load failed", e);
      setError(e?.message ?? "Failed to load dashboard data");
      setUsingMock(true);
      setAgents(MOCK_AGENTS);
      setWorkflows(MOCK_WORKFLOWS);
      setActivity([]);
      setStats({
        activeAgents: MOCK_AGENTS.length,
        activeAgentsTrend: "offline mode",
        tasksCompleted: 1284,
        tasksCompletedTrend: "+128 / 24h",
        workflowsRunning: 9,
        workflowsTrend: "0 errors",
        systemHealthPct: 0,
        systemHealthLabel: "Checking",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Derive system health from useServiceHealth statuses
  useEffect(() => {
    const list = Object.values(statuses);
    if (list.length === 0) {
      setStats((s) => ({ ...s, systemHealthPct: 0, systemHealthLabel: isChecking ? "Checking" : "Unknown" }));
      return;
    }
    const online = list.filter((s) => s.status === "online").length;
    const pct = Math.round((online / list.length) * 100);
    const label =
      pct === 100 ? "All green" : pct >= 60 ? "Degraded" : pct > 0 ? "Critical" : "Offline";
    setStats((s) => ({ ...s, systemHealthPct: pct, systemHealthLabel: label }));
  }, [statuses, isChecking]);

  return {
    loading,
    error,
    usingMock,
    agents,
    workflows,
    activity,
    stats,
    serviceStatuses: statuses,
    isCheckingHealth: isChecking,
    refresh: () => {
      load();
      checkAll();
    },
  };
}
