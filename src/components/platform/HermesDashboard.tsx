/**
 * D3VONN Hermes Dashboard
 *
 * Orchestration engine control panel showing:
 * - Active task delegations
 * - Agent routing decisions
 * - Governance enforcement status
 * - Event cascade visualization
 * - DLQ monitoring
 *
 * @module components/platform/HermesDashboard
 * @version 1.0.0
 */

import React, { useState } from "react";
import {
  Brain,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Zap,
  RefreshCw,
  Play,
  Pause,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────
// Types & Mock Data
// ─────────────────────────────────────────────────────────────────

interface Delegation {
  id: string;
  taskId: string;
  title: string;
  assignedAgent: string;
  status: "active" | "completed" | "failed" | "queued";
  priority: "critical" | "high" | "medium" | "low";
  startedAt: string;
  durationMs?: number;
  reason: string;
  confidence: number;
}

interface DLQEntry {
  id: string;
  eventType: string;
  error: string;
  attempts: number;
  firstFailedAt: string;
  resolved: boolean;
}

const ACTIVE_DELEGATIONS: Delegation[] = [
  {
    id: "del-001",
    taskId: "task-042",
    title: "Research competitor analysis",
    assignedAgent: "research-analyst",
    status: "active",
    priority: "high",
    startedAt: "30s ago",
    reason: "capability_match: web-search, source-synthesis",
    confidence: 0.94,
  },
  {
    id: "del-002",
    taskId: "task-043",
    title: "Refactor authentication module",
    assignedAgent: "code-engineer",
    status: "active",
    priority: "medium",
    startedAt: "2m ago",
    reason: "capability_match: code-review, refactoring",
    confidence: 0.91,
  },
  {
    id: "del-003",
    taskId: "task-044",
    title: "Security audit — API endpoints",
    assignedAgent: "security-sentinel",
    status: "active",
    priority: "critical",
    startedAt: "5m ago",
    reason: "capability_match: vulnerability-scanning",
    confidence: 0.97,
  },
  {
    id: "del-004",
    taskId: "task-040",
    title: "Generate quarterly report",
    assignedAgent: "data-analyst",
    status: "completed",
    priority: "medium",
    startedAt: "15m ago",
    durationMs: 12400,
    reason: "capability_match: data-visualization",
    confidence: 0.88,
  },
  {
    id: "del-005",
    taskId: "task-039",
    title: "Deploy staging environment",
    assignedAgent: "devops-engineer",
    status: "completed",
    priority: "high",
    startedAt: "20m ago",
    durationMs: 45200,
    reason: "capability_match: ci-cd, deployment",
    confidence: 0.92,
  },
];

const DLQ_ENTRIES: DLQEntry[] = [
  {
    id: "dlq-001",
    eventType: "ToolInvoked",
    error: "External API timeout after 30s",
    attempts: 3,
    firstFailedAt: "10m ago",
    resolved: false,
  },
];

const HERMES_STATS = {
  totalDelegations: 847,
  successRate: 98.2,
  avgRoutingMs: 23,
  activeNow: 3,
  dlqSize: 1,
  governanceBlocks: 2,
};

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────

const HermesDashboard: React.FC = () => {
  const [showCompleted, setShowCompleted] = useState(true);

  const priorityColors: Record<string, string> = {
    critical: "border-red-500/30 text-red-400",
    high: "border-amber-500/30 text-amber-400",
    medium: "border-blue-500/30 text-blue-400",
    low: "border-slate-500/30 text-slate-400",
  };

  const statusIcons: Record<string, React.ReactNode> = {
    active: <Play className="h-3 w-3 text-emerald-400" />,
    completed: <CheckCircle2 className="h-3 w-3 text-blue-400" />,
    failed: <XCircle className="h-3 w-3 text-red-400" />,
    queued: <Clock className="h-3 w-3 text-amber-400" />,
  };

  const filteredDelegations = showCompleted
    ? ACTIVE_DELEGATIONS
    : ACTIVE_DELEGATIONS.filter((d) => d.status === "active" || d.status === "queued");

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Brain className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Hermes Orchestration</h1>
            <p className="text-sm text-slate-400">
              Task routing, delegation, and governance enforcement
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
            <Zap className="h-3 w-3 mr-1" />
            {HERMES_STATS.avgRoutingMs}ms avg routing
          </Badge>
          <Badge variant="outline" className="border-blue-500/30 text-blue-400">
            {HERMES_STATS.successRate}% success
          </Badge>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Delegations", value: HERMES_STATS.totalDelegations, color: "text-white" },
          { label: "Active Now", value: HERMES_STATS.activeNow, color: "text-emerald-400" },
          { label: "DLQ Items", value: HERMES_STATS.dlqSize, color: HERMES_STATS.dlqSize > 0 ? "text-amber-400" : "text-emerald-400" },
          { label: "Governance Blocks", value: HERMES_STATS.governanceBlocks, color: "text-red-400" },
          { label: "Avg Routing", value: `${HERMES_STATS.avgRoutingMs}ms`, color: "text-blue-400" },
        ].map((stat) => (
          <Card key={stat.label} className="bg-slate-900/50 border-slate-800/60">
            <CardContent className="p-3 text-center">
              <div className={cn("text-xl font-bold", stat.color)}>{stat.value}</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">
                {stat.label}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Delegations */}
      <Card className="bg-slate-900/50 border-slate-800/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-300">
              Task Delegations
            </CardTitle>
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              {showCompleted ? "Hide completed" : "Show all"}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredDelegations.map((delegation) => (
              <div
                key={delegation.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/30"
              >
                {/* Status Icon */}
                <div className="flex-shrink-0">{statusIcons[delegation.status]}</div>

                {/* Task Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white truncate">{delegation.title}</span>
                    <Badge variant="outline" className={cn("text-[9px]", priorityColors[delegation.priority])}>
                      {delegation.priority}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-400">
                      Hermes
                    </span>
                    <ArrowRight className="h-3 w-3 text-slate-500" />
                    <span className="text-xs text-blue-400">{delegation.assignedAgent}</span>
                    <span className="text-xs text-slate-500">•</span>
                    <span className="text-xs text-slate-500">
                      {Math.round(delegation.confidence * 100)}% confidence
                    </span>
                  </div>
                </div>

                {/* Timing */}
                <div className="text-right flex-shrink-0">
                  <div className="text-xs text-slate-400">{delegation.startedAt}</div>
                  {delegation.durationMs && (
                    <div className="text-[10px] text-slate-500">
                      {(delegation.durationMs / 1000).toFixed(1)}s
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dead Letter Queue */}
      <Card className={cn(
        "border-slate-800/60",
        DLQ_ENTRIES.length > 0 ? "bg-amber-500/[0.02] border-amber-500/20" : "bg-slate-900/50"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <AlertTriangle className={cn("h-4 w-4", DLQ_ENTRIES.length > 0 ? "text-amber-400" : "text-slate-500")} />
              Dead Letter Queue
              {DLQ_ENTRIES.length > 0 && (
                <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[10px]">
                  {DLQ_ENTRIES.length} pending
                </Badge>
              )}
            </CardTitle>
            {DLQ_ENTRIES.length > 0 && (
              <button className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors">
                <RotateCcw className="h-3 w-3" />
                Retry All
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {DLQ_ENTRIES.length === 0 ? (
            <div className="text-center py-4 text-sm text-slate-500">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-400/50" />
              No items in dead letter queue
            </div>
          ) : (
            <div className="space-y-2">
              {DLQ_ENTRIES.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 border border-amber-500/10"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-slate-600 text-slate-300 text-[10px]">
                        {entry.eventType}
                      </Badge>
                      <span className="text-xs text-slate-400">
                        {entry.attempts} attempts
                      </span>
                    </div>
                    <div className="text-xs text-red-400 mt-1">{entry.error}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{entry.firstFailedAt}</span>
                    <button className="p-1 rounded hover:bg-slate-700 transition-colors">
                      <RefreshCw className="h-3.5 w-3.5 text-amber-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HermesDashboard;
