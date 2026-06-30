/**
 * D3VONN Platform Overview
 *
 * Dashboard showing platform-wide health metrics, active agents,
 * recent events, and system status at a glance.
 *
 * @module pages/platform/PlatformOverview
 * @version 1.0.0
 */

import React from "react";
import {
  Brain,
  Bot,
  Activity,
  Shield,
  Network,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ─────────────────────────────────────────────────────────────────
// Mock Data (will be replaced by live event bus + registry data)
// ─────────────────────────────────────────────────────────────────

const PLATFORM_METRICS = {
  activeAgents: 8,
  totalAgents: 8,
  eventsToday: 1247,
  avgLatencyMs: 142,
  policiesActive: 6,
  graphNodes: 112,
  graphEdges: 193,
  uptime: "99.97%",
};

const RECENT_EVENTS = [
  { type: "TaskCreated", agent: "hermes", time: "2s ago", status: "success" },
  { type: "AgentStarted", agent: "research-analyst", time: "5s ago", status: "success" },
  { type: "ToolInvoked", agent: "code-engineer", time: "12s ago", status: "success" },
  { type: "MemoryUpdated", agent: "hermes", time: "15s ago", status: "success" },
  { type: "SecurityAlertRaised", agent: "security-sentinel", time: "1m ago", status: "warning" },
  { type: "WorkflowCompleted", agent: "hermes", time: "2m ago", status: "success" },
];

const AGENT_STATUS = [
  { id: "hermes", name: "Hermes", status: "active", tasks: 12, health: "healthy" },
  { id: "research-analyst", name: "Research Analyst", status: "active", tasks: 3, health: "healthy" },
  { id: "code-engineer", name: "Code Engineer", status: "active", tasks: 5, health: "healthy" },
  { id: "security-sentinel", name: "Security Sentinel", status: "active", tasks: 1, health: "healthy" },
  { id: "data-analyst", name: "Data Analyst", status: "idle", tasks: 0, health: "healthy" },
  { id: "ux-designer", name: "UX Designer", status: "idle", tasks: 0, health: "healthy" },
  { id: "devops-engineer", name: "DevOps Engineer", status: "active", tasks: 2, health: "healthy" },
  { id: "content-writer", name: "Content Writer", status: "idle", tasks: 0, health: "healthy" },
];

// ─────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
  color?: string;
}> = ({ title, value, icon: Icon, trend, color = "blue" }) => (
  <Card className="bg-slate-900/50 border-slate-800/60 hover:border-slate-700/60 transition-colors">
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {trend && <p className="text-xs text-emerald-400 mt-1">{trend}</p>}
        </div>
        <div className={`p-2.5 rounded-lg bg-${color}-500/10`}>
          <Icon className={`h-5 w-5 text-${color}-400`} />
        </div>
      </div>
    </CardContent>
  </Card>
);

const StatusDot: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={`inline-block h-2 w-2 rounded-full ${
      status === "active" || status === "healthy"
        ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]"
        : status === "idle"
        ? "bg-amber-400"
        : "bg-red-400"
    }`}
  />
);

// ─────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────

const PlatformOverview: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
          <p className="text-sm text-slate-400 mt-1">
            D3VONN v2.0 — Real-time system health and metrics
          </p>
        </div>
        <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          All Systems Operational
        </Badge>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Agents"
          value={`${PLATFORM_METRICS.activeAgents}/${PLATFORM_METRICS.totalAgents}`}
          icon={Bot}
          trend="+2 this week"
          color="blue"
        />
        <MetricCard
          title="Events Today"
          value={PLATFORM_METRICS.eventsToday.toLocaleString()}
          icon={Activity}
          trend="+18% vs yesterday"
          color="purple"
        />
        <MetricCard
          title="Avg Latency"
          value={`${PLATFORM_METRICS.avgLatencyMs}ms`}
          icon={Zap}
          trend="-12ms improvement"
          color="amber"
        />
        <MetricCard
          title="Uptime"
          value={PLATFORM_METRICS.uptime}
          icon={CheckCircle2}
          color="emerald"
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent Fleet Status */}
        <Card className="bg-slate-900/50 border-slate-800/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Bot className="h-4 w-4 text-blue-400" />
              Agent Fleet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {AGENT_STATUS.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center justify-between py-2 px-3 rounded-md bg-slate-800/30"
                >
                  <div className="flex items-center gap-2.5">
                    <StatusDot status={agent.status} />
                    <span className="text-sm text-white">{agent.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">
                      {agent.tasks > 0 ? `${agent.tasks} tasks` : "idle"}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        agent.status === "active"
                          ? "border-emerald-500/30 text-emerald-400"
                          : "border-slate-600 text-slate-400"
                      }`}
                    >
                      {agent.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Events */}
        <Card className="bg-slate-900/50 border-slate-800/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-400" />
              Recent Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {RECENT_EVENTS.map((event, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 px-3 rounded-md bg-slate-800/30"
                >
                  <div className="flex items-center gap-2.5">
                    {event.status === "success" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                    )}
                    <span className="text-sm text-white">{event.type}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">{event.agent}</span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {event.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-900/50 border-slate-800/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Network className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-medium text-slate-300">Knowledge Graph</span>
            </div>
            <div className="text-lg font-bold text-white">
              {PLATFORM_METRICS.graphNodes} nodes
            </div>
            <div className="text-xs text-slate-400">
              {PLATFORM_METRICS.graphEdges} edges • 8 categories
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium text-slate-300">Security Policies</span>
            </div>
            <div className="text-lg font-bold text-white">
              {PLATFORM_METRICS.policiesActive} active
            </div>
            <div className="text-xs text-slate-400">
              0 violations today • RBAC enforced
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-purple-400" />
              <span className="text-sm font-medium text-slate-300">Hermes Engine</span>
            </div>
            <div className="text-lg font-bold text-white">Operational</div>
            <div className="text-xs text-slate-400">
              12 active delegations • 0 DLQ items
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PlatformOverview;
