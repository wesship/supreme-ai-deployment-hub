/**
 * D3VONN Usage Metering Panel
 *
 * Real-time usage metering view showing API calls, agent invocations,
 * storage consumption, and per-workspace breakdowns.
 */

import { useState } from "react";

interface MeteringEntry {
  metric: string;
  count: number;
  trend: "up" | "down" | "stable";
  lastHour: number;
  last24h: number;
}

interface WorkspaceUsage {
  workspaceId: string;
  workspaceName: string;
  apiCalls: number;
  agentInvocations: number;
  storageGb: number;
}

const MOCK_METERING: MeteringEntry[] = [
  { metric: "API Calls", count: 32450, trend: "up", lastHour: 245, last24h: 4820 },
  { metric: "Agent Invocations", count: 4200, trend: "up", lastHour: 32, last24h: 580 },
  { metric: "Events Published", count: 18920, trend: "stable", lastHour: 156, last24h: 3200 },
  { metric: "Webhook Deliveries", count: 8430, trend: "down", lastHour: 45, last24h: 920 },
  { metric: "Knowledge Queries", count: 12100, trend: "up", lastHour: 89, last24h: 1450 },
  { metric: "Integration Calls", count: 5670, trend: "stable", lastHour: 38, last24h: 780 },
  { metric: "Storage Writes", count: 2340, trend: "up", lastHour: 15, last24h: 290 },
  { metric: "Storage Reads", count: 45600, trend: "up", lastHour: 320, last24h: 6100 },
];

const MOCK_WORKSPACES: WorkspaceUsage[] = [
  { workspaceId: "ws-prod", workspaceName: "Production", apiCalls: 22000, agentInvocations: 3100, storageGb: 18.5 },
  { workspaceId: "ws-staging", workspaceName: "Staging", apiCalls: 7200, agentInvocations: 800, storageGb: 6.2 },
  { workspaceId: "ws-dev", workspaceName: "Development", apiCalls: 3250, agentInvocations: 300, storageGb: 3.3 },
];

export function UsageMeteringPanel() {
  const [metering] = useState<MeteringEntry[]>(MOCK_METERING);
  const [workspaces] = useState<WorkspaceUsage[]>(MOCK_WORKSPACES);
  const [timeRange, setTimeRange] = useState<"1h" | "24h" | "7d" | "30d">("24h");

  const trendIcons = { up: "↑", down: "↓", stable: "→" };
  const trendColors = { up: "text-green-400", down: "text-red-400", stable: "text-gray-400" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Usage Metering</h2>
        <div className="flex gap-2">
          {(["1h", "24h", "7d", "30d"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 rounded text-sm ${
                timeRange === range
                  ? "bg-purple-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Metering Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metering.map((entry) => (
          <div key={entry.metric} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-sm text-gray-400">{entry.metric}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-white">
                {entry.count.toLocaleString()}
              </span>
              <span className={`text-sm ${trendColors[entry.trend]}`}>
                {trendIcons[entry.trend]}
              </span>
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>Last hour: {entry.lastHour}</span>
              <span>24h: {entry.last24h.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Workspace Breakdown */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Workspace Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2">Workspace</th>
                <th className="text-right py-2">API Calls</th>
                <th className="text-right py-2">Agent Invocations</th>
                <th className="text-right py-2">Storage (GB)</th>
                <th className="text-right py-2">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {workspaces.map((ws) => {
                const totalCalls = workspaces.reduce((s, w) => s + w.apiCalls, 0);
                const pct = Math.round((ws.apiCalls / totalCalls) * 100);
                return (
                  <tr key={ws.workspaceId} className="border-b border-gray-700/50">
                    <td className="py-3 text-white">{ws.workspaceName}</td>
                    <td className="py-3 text-right text-gray-300">{ws.apiCalls.toLocaleString()}</td>
                    <td className="py-3 text-right text-gray-300">{ws.agentInvocations.toLocaleString()}</td>
                    <td className="py-3 text-right text-gray-300">{ws.storageGb.toFixed(1)}</td>
                    <td className="py-3 text-right">
                      <span className="text-purple-400">{pct}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default UsageMeteringPanel;
