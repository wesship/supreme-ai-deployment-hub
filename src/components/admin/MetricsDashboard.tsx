/**
 * MetricsDashboard — Platform metrics visualization
 *
 * Displays:
 * - Event bus throughput (published, delivered, failed, DLQ)
 * - Agent performance (invocations, errors, response time)
 * - Workflow metrics (started, completed, failed, duration)
 * - RBAC decisions (allowed, denied, escalated)
 * - HTTP metrics (requests, latency, errors)
 */

import React, { useState } from "react";

interface MetricCard {
  name: string;
  value: number;
  unit: string;
  change: number;
  changeLabel: string;
}

interface MetricGroup {
  title: string;
  icon: string;
  metrics: MetricCard[];
}

const METRIC_GROUPS: MetricGroup[] = [
  {
    title: "Event Bus",
    icon: "⚡",
    metrics: [
      { name: "Published", value: 14283, unit: "events", change: 12.4, changeLabel: "vs last hour" },
      { name: "Delivered", value: 14271, unit: "events", change: 12.3, changeLabel: "vs last hour" },
      { name: "Failed", value: 8, unit: "events", change: -45.0, changeLabel: "vs last hour" },
      { name: "DLQ Depth", value: 3, unit: "items", change: -25.0, changeLabel: "vs last hour" },
      { name: "Avg Latency", value: 12, unit: "ms", change: -8.2, changeLabel: "vs last hour" },
      { name: "Replayed", value: 42, unit: "events", change: 0, changeLabel: "today" },
    ],
  },
  {
    title: "Agent Fleet",
    icon: "🤖",
    metrics: [
      { name: "Invocations", value: 8472, unit: "calls", change: 15.7, changeLabel: "vs last hour" },
      { name: "Errors", value: 23, unit: "errors", change: -12.0, changeLabel: "vs last hour" },
      { name: "Active", value: 6, unit: "agents", change: 0, changeLabel: "of 8 total" },
      { name: "Avg Response", value: 145, unit: "ms", change: -5.3, changeLabel: "vs last hour" },
      { name: "Health Score", value: 0.97, unit: "", change: 1.0, changeLabel: "vs yesterday" },
      { name: "Queue Depth", value: 12, unit: "tasks", change: -33.0, changeLabel: "vs last hour" },
    ],
  },
  {
    title: "Workflows",
    icon: "🔄",
    metrics: [
      { name: "Started", value: 342, unit: "runs", change: 8.2, changeLabel: "vs last hour" },
      { name: "Completed", value: 338, unit: "runs", change: 9.1, changeLabel: "vs last hour" },
      { name: "Failed", value: 4, unit: "runs", change: -50.0, changeLabel: "vs last hour" },
      { name: "Avg Duration", value: 2340, unit: "ms", change: -12.5, changeLabel: "vs last hour" },
      { name: "Success Rate", value: 98.8, unit: "%", change: 0.5, changeLabel: "vs yesterday" },
      { name: "Timeout", value: 0, unit: "runs", change: 0, changeLabel: "today" },
    ],
  },
  {
    title: "RBAC",
    icon: "🛡️",
    metrics: [
      { name: "Allowed", value: 24891, unit: "decisions", change: 14.2, changeLabel: "vs last hour" },
      { name: "Denied", value: 47, unit: "decisions", change: -8.0, changeLabel: "vs last hour" },
      { name: "Escalated", value: 3, unit: "requests", change: 0, changeLabel: "today" },
      { name: "Denial Rate", value: 0.19, unit: "%", change: -22.0, changeLabel: "vs yesterday" },
      { name: "Avg Check", value: 0.3, unit: "ms", change: 0, changeLabel: "stable" },
      { name: "Policies Active", value: 6, unit: "rules", change: 0, changeLabel: "total" },
    ],
  },
  {
    title: "HTTP",
    icon: "🌐",
    metrics: [
      { name: "Requests", value: 45672, unit: "req", change: 18.3, changeLabel: "vs last hour" },
      { name: "Avg Latency", value: 34, unit: "ms", change: -4.2, changeLabel: "vs last hour" },
      { name: "P95 Latency", value: 142, unit: "ms", change: -7.8, changeLabel: "vs last hour" },
      { name: "P99 Latency", value: 389, unit: "ms", change: -2.1, changeLabel: "vs last hour" },
      { name: "5xx Errors", value: 2, unit: "errors", change: -75.0, changeLabel: "vs last hour" },
      { name: "4xx Errors", value: 89, unit: "errors", change: 5.2, changeLabel: "vs last hour" },
    ],
  },
];

type TimeRange = "1h" | "6h" | "24h" | "7d" | "30d";

export const MetricsDashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>("1h");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const timeRanges: TimeRange[] = ["1h", "6h", "24h", "7d", "30d"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Platform Metrics</h2>
          <p className="text-sm text-gray-400 mt-1">
            Real-time performance and operational metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          {timeRanges.map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                timeRange === range
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  : "bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Groups */}
      {METRIC_GROUPS.map((group) => (
        <div
          key={group.title}
          className={`bg-gray-800/50 rounded-lg border transition-colors cursor-pointer ${
            selectedGroup === group.title
              ? "border-blue-500/50"
              : "border-gray-700 hover:border-gray-600"
          }`}
          onClick={() => setSelectedGroup(selectedGroup === group.title ? null : group.title)}
        >
          <div className="px-4 py-3 border-b border-gray-700/50 flex items-center gap-2">
            <span className="text-lg">{group.icon}</span>
            <h3 className="text-sm font-semibold text-white">{group.title}</h3>
          </div>
          <div className="grid grid-cols-6 gap-4 p-4">
            {group.metrics.map((metric) => (
              <div key={`${group.title}-${metric.name}`} className="text-center">
                <p className="text-xs text-gray-400 mb-1">{metric.name}</p>
                <p className="text-lg font-mono text-white">
                  {typeof metric.value === "number" && metric.value >= 1000
                    ? `${(metric.value / 1000).toFixed(1)}k`
                    : metric.value}
                  {metric.unit && <span className="text-xs text-gray-500 ml-1">{metric.unit}</span>}
                </p>
                <p className={`text-xs mt-0.5 ${
                  metric.change > 0 ? "text-green-400" :
                  metric.change < 0 ? "text-red-400" : "text-gray-500"
                }`}>
                  {metric.change > 0 ? "+" : ""}{metric.change}% {metric.changeLabel}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Throughput Summary */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Throughput Summary ({timeRange})</h3>
        <div className="grid grid-cols-5 gap-4">
          <div className="text-center p-3 bg-gray-900/50 rounded-lg">
            <p className="text-2xl font-mono text-blue-400">14.3k</p>
            <p className="text-xs text-gray-400 mt-1">Events/hr</p>
          </div>
          <div className="text-center p-3 bg-gray-900/50 rounded-lg">
            <p className="text-2xl font-mono text-purple-400">8.5k</p>
            <p className="text-xs text-gray-400 mt-1">Agent calls/hr</p>
          </div>
          <div className="text-center p-3 bg-gray-900/50 rounded-lg">
            <p className="text-2xl font-mono text-green-400">342</p>
            <p className="text-xs text-gray-400 mt-1">Workflows/hr</p>
          </div>
          <div className="text-center p-3 bg-gray-900/50 rounded-lg">
            <p className="text-2xl font-mono text-yellow-400">45.7k</p>
            <p className="text-xs text-gray-400 mt-1">HTTP req/hr</p>
          </div>
          <div className="text-center p-3 bg-gray-900/50 rounded-lg">
            <p className="text-2xl font-mono text-cyan-400">24.9k</p>
            <p className="text-xs text-gray-400 mt-1">RBAC checks/hr</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetricsDashboard;
