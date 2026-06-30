/**
 * ErrorTraceViewer — Sentry error trace visualization
 *
 * Displays:
 * - Recent errors with stack traces
 * - Error grouping and frequency
 * - Tenant/agent context for each error
 * - Breadcrumb timeline
 * - Error trends and resolution status
 */

import React, { useState } from "react";

interface ErrorTrace {
  id: string;
  title: string;
  type: string;
  message: string;
  level: "fatal" | "error" | "warning";
  count: number;
  firstSeen: string;
  lastSeen: string;
  status: "unresolved" | "resolved" | "ignored";
  tags: Record<string, string>;
  stackTrace: string[];
  breadcrumbs: Array<{
    timestamp: string;
    category: string;
    message: string;
    level: string;
  }>;
}

const MOCK_ERRORS: ErrorTrace[] = [
  {
    id: "err-001",
    title: "AgentTimeoutError",
    type: "AgentTimeoutError",
    message: "Agent 'research-analyst' exceeded 30s timeout on task task-4821",
    level: "error",
    count: 3,
    firstSeen: new Date(Date.now() - 86400000).toISOString(),
    lastSeen: new Date(Date.now() - 3600000).toISOString(),
    status: "unresolved",
    tags: { agentId: "research-analyst", tenantId: "tenant-acme", environment: "production" },
    stackTrace: [
      "AgentTimeoutError: Agent 'research-analyst' exceeded 30s timeout",
      "    at AgentMesh.executeTask (shared/agents/mesh.ts:142:11)",
      "    at HermesOrchestrator.delegate (agents/hermes/orchestrator.ts:89:24)",
      "    at TaskRouter.route (shared/events/event-handlers.ts:67:18)",
      "    at D3VONNEventBus.publish (shared/events/event-bus.ts:134:9)",
      "    at processTicksAndRejections (node:internal/process/task_queues:95:5)",
    ],
    breadcrumbs: [
      { timestamp: new Date(Date.now() - 3605000).toISOString(), category: "event-bus", message: "TaskCreated published", level: "info" },
      { timestamp: new Date(Date.now() - 3604000).toISOString(), category: "agent", message: "Hermes: selecting agent for code-review", level: "info" },
      { timestamp: new Date(Date.now() - 3603000).toISOString(), category: "agent", message: "research-analyst: task started", level: "info" },
      { timestamp: new Date(Date.now() - 3602000).toISOString(), category: "agent", message: "research-analyst: tool invoked (web-search)", level: "info" },
      { timestamp: new Date(Date.now() - 3601000).toISOString(), category: "http", message: "GET https://api.openai.com/v1/chat/completions - timeout", level: "warning" },
      { timestamp: new Date(Date.now() - 3600000).toISOString(), category: "agent", message: "research-analyst: timeout after 30000ms", level: "error" },
    ],
  },
  {
    id: "err-002",
    title: "EventSchemaValidationError",
    type: "ValidationError",
    message: "Invalid payload for event 'MemoryUpdated': missing required field 'agentId'",
    level: "warning",
    count: 7,
    firstSeen: new Date(Date.now() - 172800000).toISOString(),
    lastSeen: new Date(Date.now() - 7200000).toISOString(),
    status: "unresolved",
    tags: { component: "event-bus", eventType: "MemoryUpdated", tenantId: "tenant-beta" },
    stackTrace: [
      "ValidationError: Invalid payload for event 'MemoryUpdated'",
      "    at EventSchema.validate (shared/events/event-schema.ts:89:15)",
      "    at D3VONNEventBus.publish (shared/events/event-bus.ts:128:22)",
      "    at MemoryManager.persist (shared/tenancy/tenant-memory.ts:45:9)",
      "    at async AgentWorker.updateMemory (agents/worker.ts:112:5)",
    ],
    breadcrumbs: [
      { timestamp: new Date(Date.now() - 7201000).toISOString(), category: "agent", message: "code-engineer: task completed", level: "info" },
      { timestamp: new Date(Date.now() - 7200500).toISOString(), category: "memory", message: "Attempting memory persist", level: "info" },
      { timestamp: new Date(Date.now() - 7200000).toISOString(), category: "event-bus", message: "Schema validation failed for MemoryUpdated", level: "error" },
    ],
  },
  {
    id: "err-003",
    title: "TenantQuotaExceeded",
    type: "QuotaError",
    message: "Tenant 'tenant-free-123' exceeded monthly agent invocation quota (1000/1000)",
    level: "warning",
    count: 42,
    firstSeen: new Date(Date.now() - 604800000).toISOString(),
    lastSeen: new Date(Date.now() - 1800000).toISOString(),
    status: "ignored",
    tags: { tenantId: "tenant-free-123", plan: "free", component: "rbac" },
    stackTrace: [
      "QuotaError: Tenant 'tenant-free-123' exceeded monthly quota",
      "    at RBACEnforcer.checkQuota (shared/rbac/rbac-enforcer.ts:198:13)",
      "    at TenantMiddleware.enforce (shared/tenancy/middleware.ts:56:18)",
      "    at Router.handle (server/router.ts:34:11)",
    ],
    breadcrumbs: [
      { timestamp: new Date(Date.now() - 1801000).toISOString(), category: "http", message: "POST /api/agents/invoke", level: "info" },
      { timestamp: new Date(Date.now() - 1800500).toISOString(), category: "rbac", message: "Checking quota for tenant-free-123", level: "info" },
      { timestamp: new Date(Date.now() - 1800000).toISOString(), category: "rbac", message: "Quota exceeded: 1000/1000 invocations", level: "warning" },
    ],
  },
];

const levelColors: Record<string, string> = {
  fatal: "text-red-500 bg-red-500/10",
  error: "text-red-400 bg-red-500/10",
  warning: "text-yellow-400 bg-yellow-500/10",
};

const statusColors: Record<string, string> = {
  unresolved: "text-red-400",
  resolved: "text-green-400",
  ignored: "text-gray-400",
};

export const ErrorTraceViewer: React.FC = () => {
  const [selectedError, setSelectedError] = useState<ErrorTrace | null>(null);
  const [filter, setFilter] = useState<"all" | "unresolved" | "resolved" | "ignored">("all");

  const filteredErrors = filter === "all"
    ? MOCK_ERRORS
    : MOCK_ERRORS.filter((e) => e.status === filter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Error Traces</h2>
          <p className="text-sm text-gray-400 mt-1">
            Sentry-integrated error tracking with full context
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["all", "unresolved", "resolved", "ignored"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  : "bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Error List */}
        <div className="col-span-1 space-y-2">
          {filteredErrors.map((error) => (
            <div
              key={error.id}
              onClick={() => setSelectedError(error)}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedError?.id === error.id
                  ? "border-blue-500/50 bg-blue-500/5"
                  : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${levelColors[error.level]}`}>
                  {error.level}
                </span>
                <span className="text-xs text-gray-400">{error.count}x</span>
              </div>
              <p className="text-sm font-medium text-white mt-1 truncate">{error.title}</p>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{error.message}</p>
              <div className="flex items-center justify-between mt-2">
                <span className={`text-xs ${statusColors[error.status]}`}>{error.status}</span>
                <span className="text-xs text-gray-500">
                  {new Date(error.lastSeen).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Error Detail */}
        <div className="col-span-2">
          {selectedError ? (
            <div className="space-y-4">
              {/* Error Header */}
              <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">{selectedError.title}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${levelColors[selectedError.level]}`}>
                    {selectedError.level}
                  </span>
                </div>
                <p className="text-sm text-gray-300 mt-2">{selectedError.message}</p>
                <div className="flex gap-2 mt-3">
                  {Object.entries(selectedError.tags).map(([k, v]) => (
                    <span key={k} className="px-2 py-0.5 text-xs bg-gray-700 rounded text-gray-300">
                      {k}: {v}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                  <span>First seen: {new Date(selectedError.firstSeen).toLocaleString()}</span>
                  <span>Last seen: {new Date(selectedError.lastSeen).toLocaleString()}</span>
                  <span>Occurrences: {selectedError.count}</span>
                </div>
              </div>

              {/* Stack Trace */}
              <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
                <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Stack Trace</h4>
                <pre className="text-xs text-gray-300 font-mono overflow-x-auto">
                  {selectedError.stackTrace.join("\n")}
                </pre>
              </div>

              {/* Breadcrumbs */}
              <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
                <h4 className="text-xs font-semibold text-gray-400 uppercase mb-3">Breadcrumbs</h4>
                <div className="space-y-2">
                  {selectedError.breadcrumbs.map((crumb, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="text-xs text-gray-500 font-mono whitespace-nowrap">
                        {new Date(crumb.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="px-1.5 py-0.5 text-xs bg-gray-700 rounded text-gray-300">
                        {crumb.category}
                      </span>
                      <span className={`text-xs ${
                        crumb.level === "error" ? "text-red-400" :
                        crumb.level === "warning" ? "text-yellow-400" : "text-gray-300"
                      }`}>
                        {crumb.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button className="px-4 py-2 text-sm bg-green-500/20 text-green-400 rounded border border-green-500/30 hover:bg-green-500/30">
                  Mark Resolved
                </button>
                <button className="px-4 py-2 text-sm bg-gray-700 text-gray-300 rounded border border-gray-600 hover:bg-gray-600">
                  Ignore
                </button>
                <button className="px-4 py-2 text-sm bg-blue-500/20 text-blue-400 rounded border border-blue-500/30 hover:bg-blue-500/30">
                  Create Issue
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <p>Select an error to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorTraceViewer;
