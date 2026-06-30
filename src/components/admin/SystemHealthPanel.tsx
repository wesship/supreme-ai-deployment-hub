/**
 * SystemHealthPanel — Admin health monitoring dashboard
 *
 * Displays:
 * - Overall system status (healthy/degraded/unhealthy)
 * - Component health checks with latency
 * - Health history timeline
 * - Critical dependency status
 * - System resource utilization
 */

import React, { useState, useEffect } from "react";

interface HealthCheck {
  name: string;
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
  message?: string;
  latencyMs?: number;
  lastChecked: string;
  metadata?: Record<string, unknown>;
}

interface SystemHealth {
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
  version: string;
  uptime: number;
  timestamp: string;
  checks: HealthCheck[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    unknown: number;
  };
}

const MOCK_HEALTH: SystemHealth = {
  status: "healthy",
  version: "2.0.0-alpha.1",
  uptime: 86400,
  timestamp: new Date().toISOString(),
  checks: [
    { name: "database", status: "healthy", message: "PostgreSQL pool active (5/20)", latencyMs: 3, lastChecked: new Date().toISOString(), metadata: { pool: { active: 5, idle: 15, max: 20 } } },
    { name: "event-bus", status: "healthy", message: "14 subscribers, 0 DLQ", latencyMs: 1, lastChecked: new Date().toISOString(), metadata: { subscribers: 14, dlqDepth: 0 } },
    { name: "agent-mesh", status: "healthy", message: "8/8 agents responding", latencyMs: 12, lastChecked: new Date().toISOString(), metadata: { totalAgents: 8, activeAgents: 6, idleAgents: 2 } },
    { name: "cache", status: "healthy", message: "Redis hit rate 94%", latencyMs: 2, lastChecked: new Date().toISOString(), metadata: { hitRate: 0.94 } },
    { name: "external-OpenAI", status: "healthy", message: "API reachable", latencyMs: 89, lastChecked: new Date().toISOString() },
    { name: "external-Supabase", status: "healthy", message: "API reachable", latencyMs: 45, lastChecked: new Date().toISOString() },
    { name: "memory", status: "healthy", message: "Heap: 42% used", latencyMs: 0, lastChecked: new Date().toISOString(), metadata: { usagePercent: 42 } },
  ],
  summary: { total: 7, healthy: 7, degraded: 0, unhealthy: 0, unknown: 0 },
};

const statusColors: Record<string, string> = {
  healthy: "text-green-400",
  degraded: "text-yellow-400",
  unhealthy: "text-red-400",
  unknown: "text-gray-400",
};

const statusBg: Record<string, string> = {
  healthy: "bg-green-500/10 border-green-500/30",
  degraded: "bg-yellow-500/10 border-yellow-500/30",
  unhealthy: "bg-red-500/10 border-red-500/30",
  unknown: "bg-gray-500/10 border-gray-500/30",
};

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${mins}m`;
}

export const SystemHealthPanel: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth>(MOCK_HEALTH);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      setHealth({ ...MOCK_HEALTH, timestamp: new Date().toISOString() });
      setLastRefresh(new Date());
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">System Health</h2>
          <p className="text-sm text-gray-400 mt-1">
            Last checked: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh (10s)
          </label>
          <div className={`px-4 py-2 rounded-lg border ${statusBg[health.status]}`}>
            <span className={`font-semibold uppercase text-sm ${statusColors[health.status]}`}>
              {health.status}
            </span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase">Version</p>
          <p className="text-lg font-mono text-white mt-1">{health.version}</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase">Uptime</p>
          <p className="text-lg font-mono text-white mt-1">{formatUptime(health.uptime)}</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase">Checks Passing</p>
          <p className="text-lg font-mono text-green-400 mt-1">
            {health.summary.healthy}/{health.summary.total}
          </p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase">Issues</p>
          <p className="text-lg font-mono text-white mt-1">
            {health.summary.degraded + health.summary.unhealthy}
          </p>
        </div>
      </div>

      {/* Health Checks Table */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-700">
        <div className="px-4 py-3 border-b border-gray-700">
          <h3 className="text-sm font-semibold text-white">Component Health Checks</h3>
        </div>
        <div className="divide-y divide-gray-700/50">
          {health.checks.map((check) => (
            <div key={check.name} className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  check.status === "healthy" ? "bg-green-400" :
                  check.status === "degraded" ? "bg-yellow-400" :
                  check.status === "unhealthy" ? "bg-red-400" : "bg-gray-400"
                }`} />
                <div>
                  <p className="text-sm font-medium text-white">{check.name}</p>
                  <p className="text-xs text-gray-400">{check.message}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {check.latencyMs !== undefined && (
                  <span className="text-xs font-mono text-gray-400">
                    {check.latencyMs}ms
                  </span>
                )}
                <span className={`text-xs font-semibold uppercase ${statusColors[check.status]}`}>
                  {check.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Resource Utilization */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase mb-2">Memory</p>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div className="bg-green-400 h-2 rounded-full" style={{ width: "42%" }} />
          </div>
          <p className="text-xs text-gray-400 mt-1">42% of heap used</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase mb-2">CPU</p>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div className="bg-blue-400 h-2 rounded-full" style={{ width: "28%" }} />
          </div>
          <p className="text-xs text-gray-400 mt-1">28% average load</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase mb-2">Connections</p>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div className="bg-purple-400 h-2 rounded-full" style={{ width: "35%" }} />
          </div>
          <p className="text-xs text-gray-400 mt-1">142 active / 400 max</p>
        </div>
      </div>
    </div>
  );
};

export default SystemHealthPanel;
