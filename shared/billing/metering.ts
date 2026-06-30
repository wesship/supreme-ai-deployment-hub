/**
 * D3VONN Billing — Usage Metering
 *
 * Tracks and records resource consumption per tenant/workspace
 * including API calls, agent invocations, and storage usage.
 *
 * @module shared/billing/metering
 * @version 1.0.0
 */

import type { ResourceLimits } from "./plans";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type MetricType =
  | "api_call"
  | "agent_invocation"
  | "storage_write"
  | "storage_read"
  | "event_published"
  | "webhook_delivery"
  | "knowledge_query"
  | "integration_call";

export interface UsageRecord {
  id: string;
  tenantId: string;
  workspaceId: string;
  metric: MetricType;
  quantity: number;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface UsageSummary {
  tenantId: string;
  workspaceId: string;
  periodStart: string;
  periodEnd: string;
  metrics: Record<MetricType, number>;
  totalRecords: number;
}

export interface UsageSnapshot {
  apiCalls: number;
  agentInvocations: number;
  storageGb: number;
  eventsPublished: number;
  webhookDeliveries: number;
  knowledgeQueries: number;
  integrationCalls: number;
}

export interface UsagePercentage {
  metric: string;
  used: number;
  limit: number;
  percentage: number;
  status: "ok" | "warning" | "critical" | "exceeded";
}

// ─────────────────────────────────────────────────────────────────
// Metering Engine
// ─────────────────────────────────────────────────────────────────

export class UsageMeter {
  private records: UsageRecord[] = [];
  private aggregateCache: Map<string, UsageSummary> = new Map();
  private listeners: Array<(record: UsageRecord) => void> = [];

  record(params: {
    tenantId: string;
    workspaceId: string;
    metric: MetricType;
    quantity?: number;
    metadata?: Record<string, unknown>;
  }): UsageRecord {
    const record: UsageRecord = {
      id: `usage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tenantId: params.tenantId,
      workspaceId: params.workspaceId,
      metric: params.metric,
      quantity: params.quantity ?? 1,
      timestamp: new Date().toISOString(),
      metadata: params.metadata ?? {},
    };

    this.records.push(record);
    this.invalidateCache(params.tenantId, params.workspaceId);
    this.notifyListeners(record);
    return record;
  }

  recordBatch(records: Array<{
    tenantId: string;
    workspaceId: string;
    metric: MetricType;
    quantity?: number;
    metadata?: Record<string, unknown>;
  }>): UsageRecord[] {
    return records.map((r) => this.record(r));
  }

  getUsage(tenantId: string, workspaceId: string, periodStart?: string, periodEnd?: string): UsageSummary {
    const cacheKey = `${tenantId}:${workspaceId}:${periodStart ?? "all"}:${periodEnd ?? "all"}`;
    const cached = this.aggregateCache.get(cacheKey);
    if (cached) return cached;

    const start = periodStart ? new Date(periodStart).getTime() : 0;
    const end = periodEnd ? new Date(periodEnd).getTime() : Date.now();

    const filtered = this.records.filter(
      (r) =>
        r.tenantId === tenantId &&
        r.workspaceId === workspaceId &&
        new Date(r.timestamp).getTime() >= start &&
        new Date(r.timestamp).getTime() <= end
    );

    const metrics = {} as Record<MetricType, number>;
    const allMetrics: MetricType[] = [
      "api_call", "agent_invocation", "storage_write", "storage_read",
      "event_published", "webhook_delivery", "knowledge_query", "integration_call",
    ];
    for (const m of allMetrics) {
      metrics[m] = filtered
        .filter((r) => r.metric === m)
        .reduce((sum, r) => sum + r.quantity, 0);
    }

    const summary: UsageSummary = {
      tenantId,
      workspaceId,
      periodStart: periodStart ?? new Date(0).toISOString(),
      periodEnd: periodEnd ?? new Date().toISOString(),
      metrics,
      totalRecords: filtered.length,
    };

    this.aggregateCache.set(cacheKey, summary);
    return summary;
  }

  getSnapshot(tenantId: string, workspaceId: string): UsageSnapshot {
    const summary = this.getUsage(tenantId, workspaceId);
    return {
      apiCalls: summary.metrics.api_call,
      agentInvocations: summary.metrics.agent_invocation,
      storageGb: (summary.metrics.storage_write - summary.metrics.storage_read) / (1024 * 1024 * 1024),
      eventsPublished: summary.metrics.event_published,
      webhookDeliveries: summary.metrics.webhook_delivery,
      knowledgeQueries: summary.metrics.knowledge_query,
      integrationCalls: summary.metrics.integration_call,
    };
  }

  getUsagePercentages(tenantId: string, workspaceId: string, limits: ResourceLimits): UsagePercentage[] {
    const summary = this.getUsage(tenantId, workspaceId);

    const mappings: Array<{ metric: string; used: number; limit: number }> = [
      { metric: "API Calls", used: summary.metrics.api_call, limit: limits.apiCallsPerMonth },
      { metric: "Agent Invocations", used: summary.metrics.agent_invocation, limit: limits.agentInvocationsPerMonth },
      { metric: "Webhook Deliveries", used: summary.metrics.webhook_delivery, limit: limits.webhooksMax * 1000 },
      { metric: "Knowledge Queries", used: summary.metrics.knowledge_query, limit: limits.knowledgeGraphNodes * 100 },
    ];

    return mappings.map(({ metric, used, limit }) => {
      const percentage = limit === Infinity ? 0 : Math.round((used / limit) * 100);
      let status: UsagePercentage["status"] = "ok";
      if (percentage >= 100) status = "exceeded";
      else if (percentage >= 90) status = "critical";
      else if (percentage >= 75) status = "warning";

      return { metric, used, limit, percentage, status };
    });
  }

  getRecordCount(): number {
    return this.records.length;
  }

  getRecords(tenantId?: string): UsageRecord[] {
    if (!tenantId) return [...this.records];
    return this.records.filter((r) => r.tenantId === tenantId);
  }

  onRecord(listener: (record: UsageRecord) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  reset(): void {
    this.records = [];
    this.aggregateCache.clear();
  }

  private invalidateCache(tenantId: string, workspaceId: string): void {
    for (const key of this.aggregateCache.keys()) {
      if (key.startsWith(`${tenantId}:${workspaceId}:`)) {
        this.aggregateCache.delete(key);
      }
    }
  }

  private notifyListeners(record: UsageRecord): void {
    for (const listener of this.listeners) {
      try {
        listener(record);
      } catch {
        // Listener errors should not break metering
      }
    }
  }
}

export function createUsageMeter(): UsageMeter {
  return new UsageMeter();
}
