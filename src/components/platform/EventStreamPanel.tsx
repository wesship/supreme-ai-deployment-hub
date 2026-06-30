/**
 * D3VONN Event Stream Panel
 *
 * Live event stream viewer with:
 * - Real-time event feed
 * - Event type filtering
 * - Replay controls
 * - DLQ visibility
 * - Event detail inspection
 *
 * @module components/platform/EventStreamPanel
 * @version 1.0.0
 */

import React, { useState, useMemo } from "react";
import {
  Activity,
  Play,
  Pause,
  RotateCcw,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────
// Types & Mock Data
// ─────────────────────────────────────────────────────────────────

interface StreamEvent {
  id: string;
  type: string;
  timestamp: string;
  source: string;
  tenantId: string;
  status: "delivered" | "failed" | "dead-lettered" | "replayed";
  durationMs: number;
  payload: Record<string, unknown>;
  metadata: {
    correlationId: string;
    sequenceNumber: number;
  };
}

const EVENT_TYPES = [
  "TaskCreated",
  "TaskDelegated",
  "TaskCompleted",
  "AgentStarted",
  "AgentCompleted",
  "AgentFailed",
  "ToolInvoked",
  "MemoryUpdated",
  "KnowledgeIndexed",
  "SecurityAlertRaised",
  "GovernanceViolation",
  "DeploymentStarted",
  "DeploymentFinished",
  "WorkflowCompleted",
];

const MOCK_EVENTS: StreamEvent[] = [
  {
    id: "evt_001",
    type: "TaskCreated",
    timestamp: "2026-06-30T22:10:01.234Z",
    source: "api-gateway",
    tenantId: "tenant-001",
    status: "delivered",
    durationMs: 3,
    payload: { taskId: "task-042", title: "Research competitor analysis", priority: "high" },
    metadata: { correlationId: "cor_abc123", sequenceNumber: 1247 },
  },
  {
    id: "evt_002",
    type: "TaskDelegated",
    timestamp: "2026-06-30T22:10:01.257Z",
    source: "hermes",
    tenantId: "tenant-001",
    status: "delivered",
    durationMs: 23,
    payload: { taskId: "task-042", agentId: "research-analyst", confidence: 0.94 },
    metadata: { correlationId: "cor_abc123", sequenceNumber: 1248 },
  },
  {
    id: "evt_003",
    type: "AgentStarted",
    timestamp: "2026-06-30T22:10:01.280Z",
    source: "hermes",
    tenantId: "tenant-001",
    status: "delivered",
    durationMs: 5,
    payload: { agentId: "research-analyst", taskId: "task-042", model: "gpt-4o" },
    metadata: { correlationId: "cor_abc123", sequenceNumber: 1249 },
  },
  {
    id: "evt_004",
    type: "ToolInvoked",
    timestamp: "2026-06-30T22:10:02.150Z",
    source: "research-analyst",
    tenantId: "tenant-001",
    status: "delivered",
    durationMs: 870,
    payload: { agentId: "research-analyst", toolName: "web_search", success: true },
    metadata: { correlationId: "cor_abc123", sequenceNumber: 1250 },
  },
  {
    id: "evt_005",
    type: "MemoryUpdated",
    timestamp: "2026-06-30T22:10:03.020Z",
    source: "research-analyst",
    tenantId: "tenant-001",
    status: "delivered",
    durationMs: 12,
    payload: { agentId: "research-analyst", memoryType: "episodic", operation: "store" },
    metadata: { correlationId: "cor_abc123", sequenceNumber: 1251 },
  },
  {
    id: "evt_006",
    type: "SecurityAlertRaised",
    timestamp: "2026-06-30T22:09:45.000Z",
    source: "security-sentinel",
    tenantId: "tenant-001",
    status: "delivered",
    durationMs: 8,
    payload: { severity: "medium", type: "rate-limit-exceeded", target: "api/v1/tasks" },
    metadata: { correlationId: "cor_def456", sequenceNumber: 1246 },
  },
  {
    id: "evt_007",
    type: "ToolInvoked",
    timestamp: "2026-06-30T22:09:30.000Z",
    source: "code-engineer",
    tenantId: "tenant-001",
    status: "failed",
    durationMs: 30000,
    payload: { agentId: "code-engineer", toolName: "external_api", success: false },
    metadata: { correlationId: "cor_ghi789", sequenceNumber: 1245 },
  },
  {
    id: "evt_008",
    type: "WorkflowCompleted",
    timestamp: "2026-06-30T22:09:15.000Z",
    source: "hermes",
    tenantId: "tenant-001",
    status: "delivered",
    durationMs: 4,
    payload: { workflowId: "wf-041", status: "success", stepsCompleted: 5 },
    metadata: { correlationId: "cor_jkl012", sequenceNumber: 1244 },
  },
  {
    id: "evt_009",
    type: "DeploymentFinished",
    timestamp: "2026-06-30T22:08:50.000Z",
    source: "devops-engineer",
    tenantId: "tenant-001",
    status: "delivered",
    durationMs: 6,
    payload: { environment: "staging", version: "2.0.0-alpha.1", success: true },
    metadata: { correlationId: "cor_mno345", sequenceNumber: 1243 },
  },
  {
    id: "evt_010",
    type: "AgentFailed",
    timestamp: "2026-06-30T22:08:30.000Z",
    source: "hermes",
    tenantId: "tenant-002",
    status: "dead-lettered",
    durationMs: 15000,
    payload: { agentId: "content-writer", error: "Context window exceeded", taskId: "task-038" },
    metadata: { correlationId: "cor_pqr678", sequenceNumber: 1242 },
  },
];

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────

const EventStreamPanel: React.FC = () => {
  const [isLive, setIsLive] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const filteredEvents = useMemo(() => {
    return MOCK_EVENTS.filter((event) => {
      if (selectedTypes.length > 0 && !selectedTypes.includes(event.type)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          event.type.toLowerCase().includes(q) ||
          event.source.toLowerCase().includes(q) ||
          event.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [selectedTypes, searchQuery]);

  const stats = useMemo(() => ({
    total: MOCK_EVENTS.length,
    delivered: MOCK_EVENTS.filter((e) => e.status === "delivered").length,
    failed: MOCK_EVENTS.filter((e) => e.status === "failed").length,
    deadLettered: MOCK_EVENTS.filter((e) => e.status === "dead-lettered").length,
  }), []);

  const statusIcon = (status: string) => {
    switch (status) {
      case "delivered":
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
      case "failed":
        return <XCircle className="h-3.5 w-3.5 text-red-400" />;
      case "dead-lettered":
        return <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
      case "replayed":
        return <RotateCcw className="h-3.5 w-3.5 text-blue-400" />;
      default:
        return <Clock className="h-3.5 w-3.5 text-slate-400" />;
    }
  };

  const typeColors: Record<string, string> = {
    TaskCreated: "border-blue-500/30 text-blue-400",
    TaskDelegated: "border-purple-500/30 text-purple-400",
    TaskCompleted: "border-emerald-500/30 text-emerald-400",
    AgentStarted: "border-cyan-500/30 text-cyan-400",
    AgentCompleted: "border-emerald-500/30 text-emerald-400",
    AgentFailed: "border-red-500/30 text-red-400",
    ToolInvoked: "border-amber-500/30 text-amber-400",
    MemoryUpdated: "border-indigo-500/30 text-indigo-400",
    SecurityAlertRaised: "border-red-500/30 text-red-400",
    GovernanceViolation: "border-red-500/30 text-red-400",
    DeploymentStarted: "border-orange-500/30 text-orange-400",
    DeploymentFinished: "border-emerald-500/30 text-emerald-400",
    WorkflowCompleted: "border-emerald-500/30 text-emerald-400",
    KnowledgeIndexed: "border-teal-500/30 text-teal-400",
  };

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Activity className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Event Stream</h1>
            <p className="text-sm text-slate-400">
              Real-time event monitoring and replay
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLive(!isLive)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              isLive
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-slate-800/50 text-slate-400 border border-slate-700/50"
            )}
          >
            {isLive ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {isLive ? "Live" : "Paused"}
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:text-white transition-colors">
            <RotateCcw className="h-3 w-3" />
            Replay
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="bg-slate-900/50 border-slate-800/60">
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold text-white">{stats.total}</div>
            <div className="text-[10px] text-slate-400 uppercase">Total</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800/60">
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold text-emerald-400">{stats.delivered}</div>
            <div className="text-[10px] text-slate-400 uppercase">Delivered</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800/60">
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold text-red-400">{stats.failed}</div>
            <div className="text-[10px] text-slate-400 uppercase">Failed</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800/60">
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold text-amber-400">{stats.deadLettered}</div>
            <div className="text-[10px] text-slate-400 uppercase">DLQ</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors",
            showFilters
              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
              : "bg-slate-800/50 text-slate-400 border-slate-700/50 hover:text-white"
          )}
        >
          <Filter className="h-3 w-3" />
          Filter Types
          {selectedTypes.length > 0 && (
            <Badge className="bg-blue-500/20 text-blue-400 text-[9px] ml-1">
              {selectedTypes.length}
            </Badge>
          )}
        </button>
      </div>

      {/* Type Filter Panel */}
      {showFilters && (
        <div className="flex flex-wrap gap-1.5 p-3 bg-slate-800/30 rounded-lg border border-slate-700/30">
          {EVENT_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={cn(
                "text-[10px] px-2 py-1 rounded border transition-colors",
                selectedTypes.includes(type)
                  ? typeColors[type] || "border-blue-500/30 text-blue-400"
                  : "border-slate-700/50 text-slate-500 hover:text-slate-300"
              )}
            >
              {type}
            </button>
          ))}
        </div>
      )}

      {/* Event Stream */}
      <Card className="bg-slate-900/50 border-slate-800/60">
        <CardContent className="p-0">
          <div className="divide-y divide-slate-800/60">
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                className="hover:bg-slate-800/20 transition-colors"
              >
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => setExpandedEvent(expandedEvent === event.id ? null : event.id)}
                >
                  {/* Expand Icon */}
                  {expandedEvent === event.id ? (
                    <ChevronDown className="h-3 w-3 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-slate-400 flex-shrink-0" />
                  )}

                  {/* Status */}
                  {statusIcon(event.status)}

                  {/* Sequence */}
                  <span className="text-[10px] text-slate-500 font-mono w-8">
                    #{event.metadata.sequenceNumber}
                  </span>

                  {/* Type */}
                  <Badge variant="outline" className={cn("text-[9px]", typeColors[event.type] || "border-slate-600 text-slate-400")}>
                    {event.type}
                  </Badge>

                  {/* Source */}
                  <span className="text-xs text-slate-400 flex-1">{event.source}</span>

                  {/* Duration */}
                  <span className={cn(
                    "text-[10px] font-mono",
                    event.durationMs > 5000 ? "text-red-400" : event.durationMs > 1000 ? "text-amber-400" : "text-slate-500"
                  )}>
                    {event.durationMs}ms
                  </span>

                  {/* Timestamp */}
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {/* Expanded Detail */}
                {expandedEvent === event.id && (
                  <div className="px-4 pb-3 ml-8">
                    <div className="p-3 rounded-md bg-slate-800/50 border border-slate-700/30">
                      <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                        <div>
                          <span className="text-slate-400">Event ID:</span>{" "}
                          <span className="text-white font-mono">{event.id}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Correlation:</span>{" "}
                          <span className="text-white font-mono">{event.metadata.correlationId}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Tenant:</span>{" "}
                          <span className="text-white">{event.tenantId}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Status:</span>{" "}
                          <span className={cn(
                            event.status === "delivered" ? "text-emerald-400" :
                            event.status === "failed" ? "text-red-400" : "text-amber-400"
                          )}>{event.status}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">Payload</span>
                        <pre className="mt-1 text-[11px] text-slate-300 font-mono bg-slate-900/50 p-2 rounded overflow-x-auto">
                          {JSON.stringify(event.payload, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EventStreamPanel;
