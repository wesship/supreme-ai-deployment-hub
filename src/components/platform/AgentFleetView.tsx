/**
 * D3VONN Agent Fleet View
 *
 * Displays all registered agents with their:
 * - Health status and uptime
 * - Active task count
 * - Capabilities
 * - Event subscriptions
 * - Performance metrics
 *
 * @module components/platform/AgentFleetView
 * @version 1.0.0
 */

import React, { useState } from "react";
import {
  Bot,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity,
  Cpu,
  Clock,
  Zap,
  Filter,
  Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────
// Types & Mock Data
// ─────────────────────────────────────────────────────────────────

interface Agent {
  id: string;
  name: string;
  type: "orchestrator" | "specialist" | "utility";
  tier: "core" | "specialist" | "utility";
  status: "active" | "idle" | "error" | "maintenance";
  health: "healthy" | "degraded" | "unhealthy";
  activeTasks: number;
  completedToday: number;
  avgLatencyMs: number;
  uptime: string;
  capabilities: string[];
  model: string;
  events: { publishes: string[]; subscribes: string[] };
  lastActivity: string;
}

const AGENTS: Agent[] = [
  {
    id: "hermes",
    name: "Hermes",
    type: "orchestrator",
    tier: "core",
    status: "active",
    health: "healthy",
    activeTasks: 12,
    completedToday: 142,
    avgLatencyMs: 23,
    uptime: "99.99%",
    capabilities: ["task-routing", "agent-delegation", "policy-enforcement", "lifecycle-management"],
    model: "gpt-4o",
    events: {
      publishes: ["AgentStarted", "AgentCompleted", "TaskDelegated"],
      subscribes: ["TaskCreated", "SecurityAlertRaised"],
    },
    lastActivity: "2s ago",
  },
  {
    id: "research-analyst",
    name: "Research Analyst",
    type: "specialist",
    tier: "specialist",
    status: "active",
    health: "healthy",
    activeTasks: 3,
    completedToday: 28,
    avgLatencyMs: 1240,
    uptime: "99.95%",
    capabilities: ["web-search", "source-synthesis", "citation-generation", "report-writing"],
    model: "gpt-4o",
    events: {
      publishes: ["ToolInvoked", "MemoryUpdated"],
      subscribes: ["TaskDelegated"],
    },
    lastActivity: "15s ago",
  },
  {
    id: "code-engineer",
    name: "Code Engineer",
    type: "specialist",
    tier: "specialist",
    status: "active",
    health: "healthy",
    activeTasks: 5,
    completedToday: 67,
    avgLatencyMs: 890,
    uptime: "99.97%",
    capabilities: ["code-generation", "code-review", "refactoring", "debugging", "testing"],
    model: "gpt-4o",
    events: {
      publishes: ["ToolInvoked", "MemoryUpdated"],
      subscribes: ["TaskDelegated"],
    },
    lastActivity: "5s ago",
  },
  {
    id: "security-sentinel",
    name: "Security Sentinel",
    type: "specialist",
    tier: "specialist",
    status: "active",
    health: "healthy",
    activeTasks: 1,
    completedToday: 15,
    avgLatencyMs: 450,
    uptime: "99.99%",
    capabilities: ["vulnerability-scanning", "policy-enforcement", "threat-detection", "compliance-audit"],
    model: "gpt-4o",
    events: {
      publishes: ["SecurityAlertRaised", "GovernanceViolation"],
      subscribes: ["DeploymentStarted", "TaskDelegated"],
    },
    lastActivity: "1m ago",
  },
  {
    id: "data-analyst",
    name: "Data Analyst",
    type: "specialist",
    tier: "specialist",
    status: "idle",
    health: "healthy",
    activeTasks: 0,
    completedToday: 12,
    avgLatencyMs: 670,
    uptime: "99.92%",
    capabilities: ["data-visualization", "statistical-analysis", "trend-identification", "report-generation"],
    model: "gpt-4o",
    events: {
      publishes: ["ToolInvoked", "WorkflowCompleted"],
      subscribes: ["TaskDelegated"],
    },
    lastActivity: "5m ago",
  },
  {
    id: "ux-designer",
    name: "UX Designer",
    type: "specialist",
    tier: "specialist",
    status: "idle",
    health: "healthy",
    activeTasks: 0,
    completedToday: 8,
    avgLatencyMs: 1100,
    uptime: "99.90%",
    capabilities: ["ui-design", "wireframing", "accessibility-audit", "design-system"],
    model: "gpt-4o",
    events: {
      publishes: ["ToolInvoked"],
      subscribes: ["TaskDelegated"],
    },
    lastActivity: "12m ago",
  },
  {
    id: "devops-engineer",
    name: "DevOps Engineer",
    type: "specialist",
    tier: "specialist",
    status: "active",
    health: "healthy",
    activeTasks: 2,
    completedToday: 19,
    avgLatencyMs: 2100,
    uptime: "99.98%",
    capabilities: ["ci-cd", "deployment", "infrastructure", "monitoring", "containerization"],
    model: "gpt-4o",
    events: {
      publishes: ["DeploymentStarted", "DeploymentFinished"],
      subscribes: ["TaskDelegated"],
    },
    lastActivity: "30s ago",
  },
  {
    id: "content-writer",
    name: "Content Writer",
    type: "specialist",
    tier: "specialist",
    status: "idle",
    health: "healthy",
    activeTasks: 0,
    completedToday: 5,
    avgLatencyMs: 980,
    uptime: "99.88%",
    capabilities: ["copywriting", "technical-writing", "content-strategy", "seo-optimization"],
    model: "gpt-4o",
    events: {
      publishes: ["ToolInvoked", "MemoryUpdated"],
      subscribes: ["TaskDelegated"],
    },
    lastActivity: "20m ago",
  },
];

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────

const AgentFleetView: React.FC = () => {
  const [filter, setFilter] = useState<"all" | "active" | "idle" | "error">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  const filteredAgents = AGENTS.filter((agent) => {
    if (filter !== "all" && agent.status !== filter) return false;
    if (searchQuery && !agent.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const healthIcon = (health: string) => {
    switch (health) {
      case "healthy":
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case "degraded":
        return <AlertTriangle className="h-4 w-4 text-amber-400" />;
      default:
        return <XCircle className="h-4 w-4 text-red-400" />;
    }
  };

  const statusColors: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    idle: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    error: "bg-red-500/10 text-red-400 border-red-500/20",
    maintenance: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Bot className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Agent Fleet</h1>
            <p className="text-sm text-slate-400">
              {AGENTS.filter((a) => a.status === "active").length} active •{" "}
              {AGENTS.length} total registered
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
          {(["all", "active", "idle", "error"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                filter === f
                  ? "bg-blue-500/20 text-blue-400"
                  : "text-slate-400 hover:text-white"
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredAgents.map((agent) => (
          <Card
            key={agent.id}
            className={cn(
              "bg-slate-900/50 border-slate-800/60 hover:border-slate-700/60 transition-all cursor-pointer",
              expandedAgent === agent.id && "border-blue-500/30"
            )}
            onClick={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
          >
            <CardContent className="p-4">
              {/* Agent Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  {healthIcon(agent.health)}
                  <span className="text-sm font-medium text-white">{agent.name}</span>
                  <Badge variant="outline" className={cn("text-[9px]", statusColors[agent.status])}>
                    {agent.status}
                  </Badge>
                </div>
                <Badge variant="outline" className="border-slate-600 text-slate-400 text-[9px]">
                  {agent.tier}
                </Badge>
              </div>

              {/* Metrics Row */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="text-center">
                  <div className="text-sm font-bold text-white">{agent.activeTasks}</div>
                  <div className="text-[9px] text-slate-500">Active</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-white">{agent.completedToday}</div>
                  <div className="text-[9px] text-slate-500">Today</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-white">{agent.avgLatencyMs}ms</div>
                  <div className="text-[9px] text-slate-500">Latency</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-white">{agent.uptime}</div>
                  <div className="text-[9px] text-slate-500">Uptime</div>
                </div>
              </div>

              {/* Capabilities */}
              <div className="flex flex-wrap gap-1">
                {agent.capabilities.slice(0, expandedAgent === agent.id ? undefined : 3).map((cap) => (
                  <span
                    key={cap}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/50"
                  >
                    {cap}
                  </span>
                ))}
                {expandedAgent !== agent.id && agent.capabilities.length > 3 && (
                  <span className="text-[10px] px-1.5 py-0.5 text-slate-500">
                    +{agent.capabilities.length - 3} more
                  </span>
                )}
              </div>

              {/* Expanded Details */}
              {expandedAgent === agent.id && (
                <div className="mt-3 pt-3 border-t border-slate-800/60 space-y-2">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-3 w-3 text-slate-400" />
                    <span className="text-xs text-slate-400">Model:</span>
                    <span className="text-xs text-white">{agent.model}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-slate-400" />
                    <span className="text-xs text-slate-400">Last activity:</span>
                    <span className="text-xs text-white">{agent.lastActivity}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Publishes:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {agent.events.publishes.map((e) => (
                        <Badge key={e} variant="outline" className="text-[9px] border-purple-500/30 text-purple-400">
                          {e}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Subscribes:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {agent.events.subscribes.map((e) => (
                        <Badge key={e} variant="outline" className="text-[9px] border-cyan-500/30 text-cyan-400">
                          {e}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AgentFleetView;
