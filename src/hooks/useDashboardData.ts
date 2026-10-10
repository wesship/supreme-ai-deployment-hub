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

function pctFromHealth(score: number | null | undefined, status: string | null | undefined): number {
  if (typeof score === "number" && score > 0) return Math.round(score > 1 ? score : score * 100);
  if (status === "active" || status === "running" || status === "healthy") return 85;
  if (status === "deploying") return 40;
  if (status === "stopped" || status === "failed") return 10;
  return 50;
}

function messageFromError(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message ?? "Unknown data error");
  }
  return "Unknown data error";
}

export function useDashboardData() {
  const { statuses, isChecking, checkAll } = useServiceHealth();
  const [agents, setAgents] = useState<DashboardAgent[]>([]);
  const [workflows, setWorkflows] = useState<DashboardWorkflow[]>([]);
  const [activity, setActivity] = useState<DashboardActivity[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    activeAgents: 0,
    activeAgentsTrend: "0 total",
    tasksCompleted: 0,
    tasksCompletedTrend: "+0 / 24h",
    workflowsRunning: 0,
    workflowsTrend: "0 errors",
    systemHealthPct: 0,
    systemHealthLabel: "Checking",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [agentsRes, workflowsRes, runsRes, activityRes] = await Promise.all([
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

    const errors = [agentsRes.error, workflowsRes.error, runsRes.error, activityRes.error]
      .filter(Boolean)
      .map(messageFromError);

    const agentRows = agentsRes.error ? [] : agentsRes.data ?? [];
    const workflowRows = workflowsRes.error ? [] : workflowsRes.data ?? [];
    const runRows = runsRes.error ? [] : runsRes.data ?? [];
    const activityRows = activityRes.error ? [] : activityRes.data ?? [];

    const resolvedAgents: DashboardAgent[] = agentRows.slice(0, 8).map((agent: any) => {
      const config = agent.config && typeof agent.config === "object" ? agent.config : {};
      return {
        id: agent.id,
        name: agent.name ?? "Unnamed agent",
        status: agent.status ?? "idle",
        pct: pctFromHealth(agent.health_score, agent.status),
        tag: (config.category as string) ?? (config.tag as string) ?? "Agent",
      };
    });

    const runCounts = new Map<string, number>();
    const failedCounts = new Map<string, number>();
    runRows.forEach((run: any) => {
      if (!run.workflow_id) return;
      runCounts.set(run.workflow_id, (runCounts.get(run.workflow_id) ?? 0) + 1);
      if (run.status === "failed") {
        failedCounts.set(run.workflow_id, (failedCounts.get(run.workflow_id) ?? 0) + 1);
      }
    });

    const resolvedWorkflows: DashboardWorkflow[] = workflowRows.slice(0, 8).map((workflow: any) => ({
      id: workflow.id,
      name: workflow.name ?? "Untitled workflow",
      runs: runCounts.get(workflow.id) ?? 0,
      status:
        (failedCounts.get(workflow.id) ?? 0) > 0
          ? "Failed"
          : (runCounts.get(workflow.id) ?? 0) > 0
            ? "Healthy"
            : "Queued",
    }));

    const activeAgents = agentRows.filter((agent: any) =>
      ["active", "running", "deploying"].includes(agent.status),
    ).length;
    const tasksCompleted =
      agentRows.reduce((sum: number, agent: any) => sum + (agent.successful_runs ?? 0), 0) +
      runRows.filter((run: any) => run.status === "completed").length;
    const tasksLast24h = runRows.filter((run: any) => run.status === "completed").length;
    const errorsLast24h = runRows.filter((run: any) => run.status === "failed").length;
    const workflowsRunning = resolvedWorkflows.filter((workflow) => workflow.status !== "Queued").length;

    setAgents(resolvedAgents);
    setWorkflows(resolvedWorkflows);
    setActivity(activityRows);
    setUsingMock(false);
    setError(errors.length > 0 ? `Partial live-data failure: ${errors.join(" | ")}` : null);
    setStats((current) => ({
      ...current,
      activeAgents,
      activeAgentsTrend: `${agentRows.length} total`,
      tasksCompleted,
      tasksCompletedTrend: `+${tasksLast24h} / 24h`,
      workflowsRunning,
      workflowsTrend: `${errorsLast24h} errors`,
    }));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const list = Object.values(statuses);
    if (list.length === 0) {
      setStats((current) => ({
        ...current,
        systemHealthPct: 0,
        systemHealthLabel: isChecking ? "Checking" : "Unknown",
      }));
      return;
    }
    const online = list.filter((service) => service.status === "online").length;
    const pct = Math.round((online / list.length) * 100);
    const label = pct === 100 ? "All green" : pct >= 60 ? "Degraded" : pct > 0 ? "Critical" : "Offline";
    setStats((current) => ({ ...current, systemHealthPct: pct, systemHealthLabel: label }));
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
      void load();
      checkAll();
    },
  };
}
