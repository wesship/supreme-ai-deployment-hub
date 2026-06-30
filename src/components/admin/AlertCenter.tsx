/**
 * AlertCenter — Alert management and monitoring
 *
 * Displays:
 * - Active alerts by severity
 * - Alert rules configuration
 * - Alert history timeline
 * - Notification delivery status
 * - DLQ and RBAC denial alerts
 */

import React, { useState } from "react";

type AlertSeverity = "critical" | "high" | "medium" | "low" | "info";
type AlertStatus = "firing" | "resolved" | "acknowledged" | "silenced";

interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  value: number;
  threshold: number;
  firedAt: string;
  resolvedAt?: string;
  acknowledgedBy?: string;
  labels: Record<string, string>;
}

interface AlertRule {
  id: string;
  name: string;
  severity: AlertSeverity;
  metric: string;
  operator: string;
  value: number;
  enabled: boolean;
  channels: string[];
}

const MOCK_ACTIVE_ALERTS: Alert[] = [
  {
    id: "alert-001",
    ruleId: "dlq-depth-warning",
    ruleName: "DLQ Depth Warning",
    severity: "medium",
    status: "firing",
    message: "DLQ depth is 12 (threshold: > 10)",
    value: 12,
    threshold: 10,
    firedAt: new Date(Date.now() - 1800000).toISOString(),
    labels: { component: "event-bus", tenantId: "tenant-acme" },
  },
  {
    id: "alert-002",
    ruleId: "agent-failure-rate",
    ruleName: "Agent Failure Rate",
    severity: "low",
    status: "acknowledged",
    message: "Research Analyst error count: 5 (threshold: > 25)",
    value: 5,
    threshold: 25,
    firedAt: new Date(Date.now() - 7200000).toISOString(),
    acknowledgedBy: "admin@d3vonn.io",
    labels: { component: "agent-mesh", agentId: "research-analyst" },
  },
];

const MOCK_ALERT_RULES: AlertRule[] = [
  { id: "dlq-depth-critical", name: "DLQ Depth Critical", severity: "critical", metric: "d3vonn_events_dlq_total", operator: ">", value: 50, enabled: true, channels: ["slack", "pagerduty"] },
  { id: "dlq-depth-warning", name: "DLQ Depth Warning", severity: "medium", metric: "d3vonn_events_dlq_total", operator: ">", value: 10, enabled: true, channels: ["slack"] },
  { id: "rbac-denial-spike", name: "RBAC Denial Spike", severity: "high", metric: "d3vonn_rbac_denied_total", operator: ">", value: 100, enabled: true, channels: ["slack", "email"] },
  { id: "agent-failure-rate", name: "Agent Failure Rate", severity: "high", metric: "d3vonn_agent_errors_total", operator: ">", value: 25, enabled: true, channels: ["slack", "pagerduty"] },
  { id: "workflow-failure-rate", name: "Workflow Failure Rate", severity: "high", metric: "d3vonn_workflows_failed_total", operator: ">", value: 10, enabled: true, channels: ["slack"] },
  { id: "event-bus-latency", name: "Event Bus Latency", severity: "medium", metric: "d3vonn_event_latency_ms", operator: ">", value: 500, enabled: true, channels: ["slack"] },
  { id: "memory-usage-critical", name: "Memory Usage Critical", severity: "critical", metric: "d3vonn_memory_usage_bytes", operator: ">", value: 0.9, enabled: true, channels: ["slack", "pagerduty"] },
  { id: "http-error-spike", name: "HTTP Error Spike", severity: "high", metric: "d3vonn_http_errors_total", operator: ">", value: 50, enabled: true, channels: ["slack", "pagerduty"] },
];

const MOCK_HISTORY: Alert[] = [
  { id: "alert-h1", ruleId: "dlq-depth-critical", ruleName: "DLQ Depth Critical", severity: "critical", status: "resolved", message: "DLQ depth was 62", value: 62, threshold: 50, firedAt: new Date(Date.now() - 86400000).toISOString(), resolvedAt: new Date(Date.now() - 82800000).toISOString(), labels: { component: "event-bus" } },
  { id: "alert-h2", ruleId: "rbac-denial-spike", ruleName: "RBAC Denial Spike", severity: "high", status: "resolved", message: "142 RBAC denials in window", value: 142, threshold: 100, firedAt: new Date(Date.now() - 172800000).toISOString(), resolvedAt: new Date(Date.now() - 169200000).toISOString(), labels: { component: "rbac" } },
  { id: "alert-h3", ruleId: "http-error-spike", ruleName: "HTTP Error Spike", severity: "high", status: "resolved", message: "78 HTTP 5xx errors", value: 78, threshold: 50, firedAt: new Date(Date.now() - 259200000).toISOString(), resolvedAt: new Date(Date.now() - 255600000).toISOString(), labels: { component: "http" } },
];

const severityColors: Record<AlertSeverity, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/30",
  high: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  low: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  info: "text-gray-400 bg-gray-500/10 border-gray-500/30",
};

const statusBadge: Record<AlertStatus, string> = {
  firing: "bg-red-500/20 text-red-400",
  resolved: "bg-green-500/20 text-green-400",
  acknowledged: "bg-blue-500/20 text-blue-400",
  silenced: "bg-gray-500/20 text-gray-400",
};

type Tab = "active" | "rules" | "history";

export const AlertCenter: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>("active");

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "active", label: "Active Alerts", count: MOCK_ACTIVE_ALERTS.length },
    { id: "rules", label: "Alert Rules", count: MOCK_ALERT_RULES.length },
    { id: "history", label: "History" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Alert Center</h2>
          <p className="text-sm text-gray-400 mt-1">
            Monitor, acknowledge, and manage platform alerts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded border border-gray-700">
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-xs text-gray-300">
              {MOCK_ACTIVE_ALERTS.filter((a) => a.status === "firing").length} firing
            </span>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-5 gap-4">
        {(["critical", "high", "medium", "low", "info"] as AlertSeverity[]).map((severity) => (
          <div key={severity} className={`rounded-lg border p-3 ${severityColors[severity]}`}>
            <p className="text-xs uppercase font-semibold">{severity}</p>
            <p className="text-2xl font-mono mt-1">
              {MOCK_ACTIVE_ALERTS.filter((a) => a.severity === severity).length}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-700">
        <div className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-blue-400 text-blue-400"
                  : "border-transparent text-gray-400 hover:text-gray-300"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-gray-700 rounded">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Active Alerts */}
      {activeTab === "active" && (
        <div className="space-y-3">
          {MOCK_ACTIVE_ALERTS.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg">No active alerts</p>
              <p className="text-sm mt-1">All systems operating normally</p>
            </div>
          ) : (
            MOCK_ACTIVE_ALERTS.map((alert) => (
              <div key={alert.id} className={`rounded-lg border p-4 ${severityColors[alert.severity]}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-white">{alert.ruleName}</h4>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge[alert.status]}`}>
                        {alert.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 mt-1">{alert.message}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span>Fired: {new Date(alert.firedAt).toLocaleString()}</span>
                      {alert.acknowledgedBy && <span>Ack by: {alert.acknowledgedBy}</span>}
                      {Object.entries(alert.labels).map(([k, v]) => (
                        <span key={k} className="px-1.5 py-0.5 bg-gray-700/50 rounded">
                          {k}: {v}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {alert.status === "firing" && (
                      <button className="px-3 py-1 text-xs bg-blue-500/20 text-blue-400 rounded border border-blue-500/30 hover:bg-blue-500/30">
                        Acknowledge
                      </button>
                    )}
                    <button className="px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded border border-gray-600 hover:bg-gray-600">
                      Silence
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Alert Rules */}
      {activeTab === "rules" && (
        <div className="bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="divide-y divide-gray-700/50">
            {MOCK_ALERT_RULES.map((rule) => (
              <div key={rule.id} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${rule.enabled ? "bg-green-400" : "bg-gray-500"}`} />
                  <div>
                    <p className="text-sm font-medium text-white">{rule.name}</p>
                    <p className="text-xs text-gray-400 font-mono">
                      {rule.metric} {rule.operator} {rule.value}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    {rule.channels.map((ch) => (
                      <span key={ch} className="px-1.5 py-0.5 text-xs bg-gray-700 rounded text-gray-300">
                        {ch}
                      </span>
                    ))}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs border ${severityColors[rule.severity]}`}>
                    {rule.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {activeTab === "history" && (
        <div className="space-y-3">
          {MOCK_HISTORY.map((alert) => (
            <div key={alert.id} className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-white">{alert.ruleName}</h4>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge[alert.status]}`}>
                      {alert.status}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs border ${severityColors[alert.severity]}`}>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{alert.message}</p>
                </div>
                <div className="text-right text-xs text-gray-400">
                  <p>Fired: {new Date(alert.firedAt).toLocaleDateString()}</p>
                  {alert.resolvedAt && <p>Resolved: {new Date(alert.resolvedAt).toLocaleDateString()}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AlertCenter;
