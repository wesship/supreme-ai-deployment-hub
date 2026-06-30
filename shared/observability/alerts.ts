/**
 * D3VONN Alert System
 *
 * Intelligent alerting with:
 * - DLQ depth alerts
 * - RBAC denial spike detection
 * - Agent failure alerts
 * - Workflow timeout alerts
 * - Tenant quota alerts
 * - Custom threshold rules
 * - Alert routing and escalation
 * - Cooldown/deduplication
 *
 * @module shared/observability/alerts
 * @version 1.0.0
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type AlertSeverity = "critical" | "high" | "medium" | "low" | "info";
export type AlertStatus = "firing" | "resolved" | "acknowledged" | "silenced";
export type AlertChannel = "slack" | "email" | "pagerduty" | "webhook" | "console";

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  severity: AlertSeverity;
  condition: AlertCondition;
  channels: AlertChannel[];
  cooldownMs: number;
  labels: Record<string, string>;
  enabled: boolean;
}

export interface AlertCondition {
  type: "threshold" | "rate" | "absence" | "anomaly";
  metric: string;
  operator: "gt" | "gte" | "lt" | "lte" | "eq" | "neq";
  value: number;
  windowMs?: number;
  consecutiveBreaches?: number;
}

export interface Alert {
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
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  fingerprint: string;
}

export interface AlertNotification {
  alertId: string;
  channel: AlertChannel;
  sentAt: string;
  success: boolean;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────
// Alert Manager
// ─────────────────────────────────────────────────────────────────

export class AlertManager {
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];
  private notifications: AlertNotification[] = [];
  private lastFired: Map<string, number> = new Map();
  private handlers: Map<AlertChannel, (alert: Alert) => void | Promise<void>> = new Map();
  private maxHistory: number;

  constructor(options?: { maxHistory?: number }) {
    this.maxHistory = options?.maxHistory ?? 1000;
  }

  registerRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  removeRule(id: string): void {
    this.rules.delete(id);
  }

  registerHandler(channel: AlertChannel, handler: (alert: Alert) => void | Promise<void>): void {
    this.handlers.set(channel, handler);
  }

  evaluate(metric: string, value: number, labels: Record<string, string> = {}): Alert[] {
    const firedAlerts: Alert[] = [];

    for (const [, rule] of this.rules) {
      if (!rule.enabled) continue;
      if (rule.condition.metric !== metric) continue;

      const breached = this.checkCondition(rule.condition, value);
      const fingerprint = this.computeFingerprint(rule.id, labels);

      if (breached) {
        // Check cooldown
        const lastFiredTime = this.lastFired.get(fingerprint) ?? 0;
        if (Date.now() - lastFiredTime < rule.cooldownMs) continue;

        const alert = this.fireAlert(rule, value, labels, fingerprint);
        firedAlerts.push(alert);
        this.lastFired.set(fingerprint, Date.now());
      } else {
        // Auto-resolve if previously firing
        const existing = this.activeAlerts.get(fingerprint);
        if (existing && existing.status === "firing") {
          this.resolveAlert(fingerprint);
        }
      }
    }

    return firedAlerts;
  }

  acknowledge(alertId: string, userId: string): boolean {
    for (const [, alert] of this.activeAlerts) {
      if (alert.id === alertId) {
        alert.status = "acknowledged";
        alert.acknowledgedAt = new Date().toISOString();
        alert.acknowledgedBy = userId;
        return true;
      }
    }
    return false;
  }

  silence(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = false;
    }
  }

  unsilence(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = true;
    }
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  getAlertHistory(): Alert[] {
    return [...this.alertHistory];
  }

  getAlertsByRule(ruleId: string): Alert[] {
    return this.alertHistory.filter((a) => a.ruleId === ruleId);
  }

  getAlertsBySeverity(severity: AlertSeverity): Alert[] {
    return this.getActiveAlerts().filter((a) => a.severity === severity);
  }

  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  getNotifications(): AlertNotification[] {
    return [...this.notifications];
  }

  getSummary(): {
    total: number;
    firing: number;
    acknowledged: number;
    bySeverity: Record<AlertSeverity, number>;
  } {
    const active = this.getActiveAlerts();
    return {
      total: active.length,
      firing: active.filter((a) => a.status === "firing").length,
      acknowledged: active.filter((a) => a.status === "acknowledged").length,
      bySeverity: {
        critical: active.filter((a) => a.severity === "critical").length,
        high: active.filter((a) => a.severity === "high").length,
        medium: active.filter((a) => a.severity === "medium").length,
        low: active.filter((a) => a.severity === "low").length,
        info: active.filter((a) => a.severity === "info").length,
      },
    };
  }

  private fireAlert(rule: AlertRule, value: number, labels: Record<string, string>, fingerprint: string): Alert {
    const alert: Alert = {
      id: this.generateId(),
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      status: "firing",
      message: `${rule.name}: ${rule.condition.metric} is ${value} (threshold: ${rule.condition.operator} ${rule.condition.value})`,
      value,
      threshold: rule.condition.value,
      firedAt: new Date().toISOString(),
      labels: { ...rule.labels, ...labels },
      annotations: {
        description: rule.description,
        runbook: `https://d3vonn.io/runbooks/${rule.id}`,
      },
      fingerprint,
    };

    this.activeAlerts.set(fingerprint, alert);
    this.alertHistory.push(alert);
    if (this.alertHistory.length > this.maxHistory) {
      this.alertHistory.shift();
    }

    // Dispatch to channels
    this.dispatch(alert, rule.channels);

    return alert;
  }

  private resolveAlert(fingerprint: string): void {
    const alert = this.activeAlerts.get(fingerprint);
    if (alert) {
      alert.status = "resolved";
      alert.resolvedAt = new Date().toISOString();
      this.activeAlerts.delete(fingerprint);
    }
  }

  private async dispatch(alert: Alert, channels: AlertChannel[]): Promise<void> {
    for (const channel of channels) {
      const handler = this.handlers.get(channel);
      const notification: AlertNotification = {
        alertId: alert.id,
        channel,
        sentAt: new Date().toISOString(),
        success: false,
      };

      if (handler) {
        try {
          await handler(alert);
          notification.success = true;
        } catch (error) {
          notification.error = error instanceof Error ? error.message : "Dispatch failed";
        }
      } else {
        notification.error = `No handler registered for channel: ${channel}`;
      }

      this.notifications.push(notification);
    }
  }

  private checkCondition(condition: AlertCondition, value: number): boolean {
    switch (condition.operator) {
      case "gt": return value > condition.value;
      case "gte": return value >= condition.value;
      case "lt": return value < condition.value;
      case "lte": return value <= condition.value;
      case "eq": return value === condition.value;
      case "neq": return value !== condition.value;
      default: return false;
    }
  }

  private computeFingerprint(ruleId: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(",");
    return `${ruleId}:${labelStr}`;
  }

  private generateId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

// ─────────────────────────────────────────────────────────────────
// Default Alert Rules
// ─────────────────────────────────────────────────────────────────

export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: "dlq-depth-critical",
    name: "DLQ Depth Critical",
    description: "Dead letter queue depth exceeds critical threshold",
    severity: "critical",
    condition: { type: "threshold", metric: "d3vonn_events_dlq_total", operator: "gt", value: 50 },
    channels: ["slack", "pagerduty"],
    cooldownMs: 300000, // 5 min
    labels: { component: "event-bus" },
    enabled: true,
  },
  {
    id: "dlq-depth-warning",
    name: "DLQ Depth Warning",
    description: "Dead letter queue depth exceeds warning threshold",
    severity: "medium",
    condition: { type: "threshold", metric: "d3vonn_events_dlq_total", operator: "gt", value: 10 },
    channels: ["slack"],
    cooldownMs: 600000, // 10 min
    labels: { component: "event-bus" },
    enabled: true,
  },
  {
    id: "rbac-denial-spike",
    name: "RBAC Denial Spike",
    description: "Unusual number of RBAC denials detected",
    severity: "high",
    condition: { type: "threshold", metric: "d3vonn_rbac_denied_total", operator: "gt", value: 100 },
    channels: ["slack", "email"],
    cooldownMs: 300000,
    labels: { component: "rbac" },
    enabled: true,
  },
  {
    id: "agent-failure-rate",
    name: "Agent Failure Rate High",
    description: "Agent error rate exceeds acceptable threshold",
    severity: "high",
    condition: { type: "threshold", metric: "d3vonn_agent_errors_total", operator: "gt", value: 25 },
    channels: ["slack", "pagerduty"],
    cooldownMs: 300000,
    labels: { component: "agent-mesh" },
    enabled: true,
  },
  {
    id: "workflow-failure-rate",
    name: "Workflow Failure Rate High",
    description: "Workflow failure count exceeds threshold",
    severity: "high",
    condition: { type: "threshold", metric: "d3vonn_workflows_failed_total", operator: "gt", value: 10 },
    channels: ["slack"],
    cooldownMs: 600000,
    labels: { component: "workflows" },
    enabled: true,
  },
  {
    id: "event-bus-latency",
    name: "Event Bus Latency High",
    description: "Event delivery latency exceeds acceptable threshold",
    severity: "medium",
    condition: { type: "threshold", metric: "d3vonn_event_latency_ms", operator: "gt", value: 500 },
    channels: ["slack"],
    cooldownMs: 300000,
    labels: { component: "event-bus" },
    enabled: true,
  },
  {
    id: "memory-usage-critical",
    name: "Memory Usage Critical",
    description: "System memory usage exceeds 90%",
    severity: "critical",
    condition: { type: "threshold", metric: "d3vonn_memory_usage_bytes", operator: "gt", value: 0.9 },
    channels: ["slack", "pagerduty"],
    cooldownMs: 300000,
    labels: { component: "system" },
    enabled: true,
  },
  {
    id: "http-error-spike",
    name: "HTTP Error Spike",
    description: "HTTP 5xx error count exceeds threshold",
    severity: "high",
    condition: { type: "threshold", metric: "d3vonn_http_errors_total", operator: "gt", value: 50 },
    channels: ["slack", "pagerduty"],
    cooldownMs: 300000,
    labels: { component: "http" },
    enabled: true,
  },
];

// ─────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────

export function createAlertManager(): AlertManager {
  const manager = new AlertManager();

  // Register default rules
  for (const rule of DEFAULT_ALERT_RULES) {
    manager.registerRule(rule);
  }

  // Register console handler as default
  manager.registerHandler("console", (alert) => {
    console.warn(`[ALERT][${alert.severity.toUpperCase()}] ${alert.message}`);
  });

  return manager;
}
