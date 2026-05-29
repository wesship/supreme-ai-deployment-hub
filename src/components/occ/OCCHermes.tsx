/**
 * OCCHermes.tsx — Hermes Intelligence Fabric panel for the Operator Command Center.
 *
 * Displays live data from the 5 Hermes tables:
 *   hermes_goals, hermes_tasks, hermes_events, hermes_checkpoints, hermes_interrupts
 *
 * Data is read directly from Supabase (same pattern as other OCC panels).
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Brain, ListChecks, Zap, BookOpen, AlertTriangle } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface HermesGoal {
  id: string;
  title: string;
  description: string | null;
  status: "active" | "completed" | "archived" | "failed";
  created_at: string;
}

interface HermesTask {
  id: string;
  goal_id: string;
  kind: string;
  title: string | null;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  depth: number;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
}

interface HermesInterrupt {
  id: string;
  task_id: string;
  goal_id: string;
  prompt: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

interface HermesCheckpoint {
  id: string;
  goal_id: string;
  title: string;
  content: string;
  created_at: string;
}

interface HermesSummary {
  totalGoals: number;
  activeGoals: number;
  totalTasks: number;
  pendingTasks: number;
  processingTasks: number;
  completedTasks: number;
  failedTasks: number;
  pendingInterrupts: number;
}

// ── Status badge helpers ──────────────────────────────────────────────────────

const goalStatusColor: Record<string, string> = {
  active: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  completed: "bg-green-500/20 text-green-300 border-green-500/30",
  archived: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  failed: "bg-red-500/20 text-red-300 border-red-500/30",
};

const taskStatusColor: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  processing: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  completed: "bg-green-500/20 text-green-300 border-green-500/30",
  failed: "bg-red-500/20 text-red-300 border-red-500/30",
  cancelled: "bg-gray-500/20 text-gray-300 border-gray-500/30",
};

const interruptStatusColor: Record<string, string> = {
  pending: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  approved: "bg-green-500/20 text-green-300 border-green-500/30",
  rejected: "bg-red-500/20 text-red-300 border-red-500/30",
};

function StatusBadge({ status, colorMap }: { status: string; colorMap: Record<string, string> }) {
  const cls = colorMap[status] ?? "bg-gray-500/20 text-gray-300 border-gray-500/30";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cls}`}>
      {status}
    </span>
  );
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ── Main component ────────────────────────────────────────────────────────────

export function OCCHermes() {
  const [goals, setGoals] = useState<HermesGoal[]>([]);
  const [tasks, setTasks] = useState<HermesTask[]>([]);
  const [interrupts, setInterrupts] = useState<HermesInterrupt[]>([]);
  const [checkpoints, setCheckpoints] = useState<HermesCheckpoint[]>([]);
  const [summary, setSummary] = useState<HermesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<"goals" | "tasks" | "interrupts" | "checkpoints">("goals");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sb = supabase as any;
      const [goalsRes, tasksRes, interruptsRes, checkpointsRes] = await Promise.all([
        sb.from("hermes_goals").select("*").order("created_at", { ascending: false }).limit(50),
        sb.from("hermes_tasks").select("*").order("created_at", { ascending: false }).limit(100),
        sb.from("hermes_interrupts").select("*").order("created_at", { ascending: false }).limit(50),
        sb.from("hermes_checkpoints").select("*").order("created_at", { ascending: false }).limit(30),
      ]);

      if (goalsRes.error) throw goalsRes.error;
      if (tasksRes.error) throw tasksRes.error;
      if (interruptsRes.error) throw interruptsRes.error;
      if (checkpointsRes.error) throw checkpointsRes.error;

      const g = (goalsRes.data ?? []) as HermesGoal[];
      const t = (tasksRes.data ?? []) as HermesTask[];
      const i = (interruptsRes.data ?? []) as HermesInterrupt[];
      const c = (checkpointsRes.data ?? []) as HermesCheckpoint[];

      setGoals(g);
      setTasks(t);
      setInterrupts(i);
      setCheckpoints(c);
      setSummary({
        totalGoals: g.length,
        activeGoals: g.filter((x) => x.status === "active").length,
        totalTasks: t.length,
        pendingTasks: t.filter((x) => x.status === "pending").length,
        processingTasks: t.filter((x) => x.status === "processing").length,
        completedTasks: t.filter((x) => x.status === "completed").length,
        failedTasks: t.filter((x) => x.status === "failed").length,
        pendingInterrupts: i.filter((x) => x.status === "pending").length,
      });
      setLastRefresh(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load Hermes data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-purple-400" />
          <div>
            <h2 className="text-xl font-semibold text-white">Hermes Intelligence Fabric</h2>
            <p className="text-sm text-gray-400">
              Live view of goals, tasks, interrupts, and checkpoints
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            Last refreshed: {lastRefresh.toLocaleTimeString()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Active Goals", value: summary.activeGoals, sub: `of ${summary.totalGoals} total`, icon: Brain, color: "text-purple-400" },
            { label: "Pending Tasks", value: summary.pendingTasks, sub: `${summary.processingTasks} processing`, icon: ListChecks, color: "text-yellow-400" },
            { label: "Completed Tasks", value: summary.completedTasks, sub: `${summary.failedTasks} failed`, icon: Zap, color: "text-green-400" },
            { label: "Pending Interrupts", value: summary.pendingInterrupts, sub: "require human review", icon: AlertTriangle, color: summary.pendingInterrupts > 0 ? "text-orange-400" : "text-gray-400" },
          ].map(({ label, value, sub, icon: Icon, color }) => (
            <div key={label} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="text-xs text-gray-400">{label}</span>
              </div>
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-gray-500 mt-1">{sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-700">
        {(["goals", "tasks", "interrupts", "checkpoints"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? "text-purple-400 border-b-2 border-purple-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {tab}
            {tab === "interrupts" && summary && summary.pendingInterrupts > 0 && (
              <span className="ml-1.5 bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {summary.pendingInterrupts}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "goals" && (
        <div className="space-y-2">
          {goals.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">No goals found. Enqueue a task to create one.</p>
          ) : (
            goals.map((g) => (
              <div key={g.id} className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge status={g.status} colorMap={goalStatusColor} />
                      <span className="text-xs text-gray-500">{fmt(g.created_at)}</span>
                    </div>
                    <p className="text-sm font-medium text-white truncate">{g.title}</p>
                    {g.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{g.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-600 font-mono shrink-0">{g.id.slice(0, 8)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "tasks" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-left">
                <th className="pb-2 text-xs text-gray-400 font-medium">Kind</th>
                <th className="pb-2 text-xs text-gray-400 font-medium">Title</th>
                <th className="pb-2 text-xs text-gray-400 font-medium">Status</th>
                <th className="pb-2 text-xs text-gray-400 font-medium">Depth</th>
                <th className="pb-2 text-xs text-gray-400 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr><td colSpan={5} className="py-4 text-center text-gray-500 text-xs">No tasks found.</td></tr>
              ) : (
                tasks.map((t) => (
                  <tr key={t.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                    <td className="py-2 pr-4">
                      <span className="font-mono text-xs text-purple-300">{t.kind}</span>
                    </td>
                    <td className="py-2 pr-4 max-w-xs">
                      <span className="text-gray-200 text-xs truncate block">{t.title ?? "—"}</span>
                      {t.error_message && (
                        <span className="text-red-400 text-xs block truncate">{t.error_message}</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <StatusBadge status={t.status} colorMap={taskStatusColor} />
                    </td>
                    <td className="py-2 pr-4 text-xs text-gray-400">{t.depth}</td>
                    <td className="py-2 text-xs text-gray-500">{fmt(t.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "interrupts" && (
        <div className="space-y-2">
          {interrupts.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">No interrupts found.</p>
          ) : (
            interrupts.map((i) => (
              <div key={i.id} className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <StatusBadge status={i.status} colorMap={interruptStatusColor} />
                      <span className="text-xs text-gray-500">{fmt(i.created_at)}</span>
                    </div>
                    <p className="text-sm text-white">{i.prompt}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "checkpoints" && (
        <div className="space-y-3">
          {checkpoints.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">No checkpoints found.</p>
          ) : (
            checkpoints.map((c) => (
              <div key={c.id} className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-white">{c.title}</span>
                  <span className="text-xs text-gray-500 ml-auto">{fmt(c.created_at)}</span>
                </div>
                <p className="text-xs text-gray-400 line-clamp-4 whitespace-pre-wrap">{c.content}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
