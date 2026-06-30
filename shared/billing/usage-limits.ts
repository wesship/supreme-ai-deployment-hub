/**
 * D3VONN Billing — Usage Limits
 *
 * Enforces tenant-aware resource limits based on plan tier,
 * provides real-time limit checking and quota management.
 *
 * @module shared/billing/usage-limits
 * @version 1.0.0
 */

import type { ResourceLimits, PlanTier } from "./plans";
import type { UsageMeter, MetricType } from "./metering";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type LimitCheckResult = "allowed" | "warning" | "soft_limit" | "hard_limit";

export interface LimitCheckResponse {
  result: LimitCheckResult;
  metric: string;
  currentUsage: number;
  limit: number;
  remaining: number;
  percentage: number;
  message: string;
}

export interface QuotaStatus {
  tenantId: string;
  planTier: PlanTier;
  quotas: QuotaEntry[];
  overallStatus: "healthy" | "warning" | "critical" | "exceeded";
  resetAt: string;
}

export interface QuotaEntry {
  resource: string;
  used: number;
  limit: number;
  percentage: number;
  status: "ok" | "warning" | "critical" | "exceeded";
}

export interface LimitOverride {
  tenantId: string;
  resource: keyof ResourceLimits;
  overrideLimit: number;
  reason: string;
  expiresAt?: string;
  createdBy: string;
  createdAt: string;
}

export interface LimitEnforcerConfig {
  softLimitThreshold: number; // percentage (e.g., 80)
  warningThreshold: number;   // percentage (e.g., 90)
  hardLimitEnabled: boolean;
  gracePeriodMs: number;
  notifyOnWarning: boolean;
  notifyOnExceeded: boolean;
}

// ─────────────────────────────────────────────────────────────────
// Default Configuration
// ─────────────────────────────────────────────────────────────────

export const DEFAULT_LIMIT_CONFIG: LimitEnforcerConfig = {
  softLimitThreshold: 80,
  warningThreshold: 90,
  hardLimitEnabled: true,
  gracePeriodMs: 3600000, // 1 hour grace after hard limit
  notifyOnWarning: true,
  notifyOnExceeded: true,
};

// ─────────────────────────────────────────────────────────────────
// Metric to Resource Mapping
// ─────────────────────────────────────────────────────────────────

const METRIC_TO_RESOURCE: Record<MetricType, keyof ResourceLimits | null> = {
  api_call: "apiCallsPerMonth",
  agent_invocation: "agentInvocationsPerMonth",
  storage_write: "storageGb",
  storage_read: null, // reads are unlimited
  event_published: null, // events are unlimited
  webhook_delivery: "webhooksMax",
  knowledge_query: "knowledgeGraphNodes",
  integration_call: "customIntegrations",
};

// ─────────────────────────────────────────────────────────────────
// Usage Limit Enforcer
// ─────────────────────────────────────────────────────────────────

export class UsageLimitEnforcer {
  private config: LimitEnforcerConfig;
  private overrides: Map<string, LimitOverride[]> = new Map();
  private graceTimers: Map<string, number> = new Map();
  private notifications: Array<{
    tenantId: string;
    type: "warning" | "exceeded";
    resource: string;
    timestamp: string;
  }> = [];

  constructor(config: Partial<LimitEnforcerConfig> = {}) {
    this.config = { ...DEFAULT_LIMIT_CONFIG, ...config };
  }

  checkLimit(
    tenantId: string,
    metric: MetricType,
    currentUsage: number,
    limits: ResourceLimits
  ): LimitCheckResponse {
    const resource = METRIC_TO_RESOURCE[metric];
    if (!resource) {
      return {
        result: "allowed",
        metric,
        currentUsage,
        limit: Infinity,
        remaining: Infinity,
        percentage: 0,
        message: `${metric} is not rate-limited`,
      };
    }

    const baseLimit = limits[resource];
    const effectiveLimit = this.getEffectiveLimit(tenantId, resource, baseLimit);

    if (effectiveLimit === Infinity) {
      return {
        result: "allowed",
        metric,
        currentUsage,
        limit: Infinity,
        remaining: Infinity,
        percentage: 0,
        message: `${metric} has unlimited quota`,
      };
    }

    const percentage = Math.round((currentUsage / effectiveLimit) * 100);
    const remaining = Math.max(0, effectiveLimit - currentUsage);

    let result: LimitCheckResult;
    let message: string;

    if (currentUsage >= effectiveLimit) {
      if (this.config.hardLimitEnabled && !this.isInGracePeriod(tenantId, metric)) {
        result = "hard_limit";
        message = `${metric} quota exceeded (${currentUsage}/${effectiveLimit}). Request blocked.`;
      } else {
        result = "soft_limit";
        message = `${metric} quota exceeded (${currentUsage}/${effectiveLimit}). In grace period.`;
      }
      this.recordNotification(tenantId, "exceeded", metric);
    } else if (percentage >= this.config.warningThreshold) {
      result = "warning";
      message = `${metric} approaching limit (${percentage}% used). ${remaining} remaining.`;
      this.recordNotification(tenantId, "warning", metric);
    } else if (percentage >= this.config.softLimitThreshold) {
      result = "soft_limit";
      message = `${metric} at ${percentage}% of quota. Consider upgrading.`;
    } else {
      result = "allowed";
      message = `${metric} within quota (${percentage}% used).`;
    }

    return { result, metric, currentUsage, limit: effectiveLimit, remaining, percentage, message };
  }

  checkAllLimits(
    tenantId: string,
    meter: UsageMeter,
    workspaceId: string,
    limits: ResourceLimits
  ): LimitCheckResponse[] {
    const summary = meter.getUsage(tenantId, workspaceId);
    const results: LimitCheckResponse[] = [];

    for (const [metric, usage] of Object.entries(summary.metrics)) {
      const check = this.checkLimit(tenantId, metric as MetricType, usage, limits);
      results.push(check);
    }

    return results;
  }

  getQuotaStatus(
    tenantId: string,
    planTier: PlanTier,
    meter: UsageMeter,
    workspaceId: string,
    limits: ResourceLimits
  ): QuotaStatus {
    const checks = this.checkAllLimits(tenantId, meter, workspaceId, limits);

    const quotas: QuotaEntry[] = checks
      .filter((c) => c.limit !== Infinity)
      .map((c) => ({
        resource: c.metric,
        used: c.currentUsage,
        limit: c.limit,
        percentage: c.percentage,
        status: c.result === "hard_limit" || c.result === "soft_limit"
          ? c.percentage >= 100 ? "exceeded" as const : "critical" as const
          : c.result === "warning"
            ? "warning" as const
            : "ok" as const,
      }));

    const hasExceeded = quotas.some((q) => q.status === "exceeded");
    const hasCritical = quotas.some((q) => q.status === "critical");
    const hasWarning = quotas.some((q) => q.status === "warning");

    let overallStatus: QuotaStatus["overallStatus"] = "healthy";
    if (hasExceeded) overallStatus = "exceeded";
    else if (hasCritical) overallStatus = "critical";
    else if (hasWarning) overallStatus = "warning";

    const resetAt = new Date();
    resetAt.setMonth(resetAt.getMonth() + 1);
    resetAt.setDate(1);
    resetAt.setHours(0, 0, 0, 0);

    return { tenantId, planTier, quotas, overallStatus, resetAt: resetAt.toISOString() };
  }

  addOverride(override: LimitOverride): void {
    const existing = this.overrides.get(override.tenantId) ?? [];
    existing.push(override);
    this.overrides.set(override.tenantId, existing);
  }

  removeOverride(tenantId: string, resource: keyof ResourceLimits): void {
    const existing = this.overrides.get(tenantId) ?? [];
    this.overrides.set(
      tenantId,
      existing.filter((o) => o.resource !== resource)
    );
  }

  getOverrides(tenantId: string): LimitOverride[] {
    return (this.overrides.get(tenantId) ?? []).filter((o) => {
      if (!o.expiresAt) return true;
      return new Date(o.expiresAt).getTime() > Date.now();
    });
  }

  getNotifications(tenantId?: string): typeof this.notifications {
    if (!tenantId) return [...this.notifications];
    return this.notifications.filter((n) => n.tenantId === tenantId);
  }

  startGracePeriod(tenantId: string, metric: MetricType): void {
    const key = `${tenantId}:${metric}`;
    this.graceTimers.set(key, Date.now() + this.config.gracePeriodMs);
  }

  private getEffectiveLimit(
    tenantId: string,
    resource: keyof ResourceLimits,
    baseLimit: number
  ): number {
    const overrides = this.getOverrides(tenantId);
    const override = overrides.find((o) => o.resource === resource);
    return override ? override.overrideLimit : baseLimit;
  }

  private isInGracePeriod(tenantId: string, metric: MetricType): boolean {
    const key = `${tenantId}:${metric}`;
    const expiry = this.graceTimers.get(key);
    if (!expiry) return false;
    if (Date.now() > expiry) {
      this.graceTimers.delete(key);
      return false;
    }
    return true;
  }

  private recordNotification(tenantId: string, type: "warning" | "exceeded", resource: string): void {
    if (type === "warning" && !this.config.notifyOnWarning) return;
    if (type === "exceeded" && !this.config.notifyOnExceeded) return;

    // Deduplicate: don't notify for same resource within 5 minutes
    const recent = this.notifications.find(
      (n) =>
        n.tenantId === tenantId &&
        n.resource === resource &&
        n.type === type &&
        Date.now() - new Date(n.timestamp).getTime() < 300000
    );
    if (recent) return;

    this.notifications.push({
      tenantId,
      type,
      resource,
      timestamp: new Date().toISOString(),
    });
  }
}

export function createUsageLimitEnforcer(config?: Partial<LimitEnforcerConfig>): UsageLimitEnforcer {
  return new UsageLimitEnforcer(config);
}
