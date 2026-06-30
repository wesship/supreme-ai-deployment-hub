/**
 * D3VONN Billing — Overage Handling
 *
 * Manages overage detection, pricing, invoicing, and policy
 * enforcement when tenants exceed their plan limits.
 *
 * @module shared/billing/overage
 * @version 1.0.0
 */

import type { PlanTier, ResourceLimits } from "./plans";
import type { MetricType } from "./metering";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type OveragePolicy = "block" | "allow_and_charge" | "allow_with_warning" | "throttle";

export interface OverageRate {
  metric: MetricType;
  unitSize: number; // e.g., per 1000 API calls
  unitPrice: number; // price per unit
  currency: string;
  maxOverageUnits: number; // cap on overage charges
}

export interface OverageEvent {
  id: string;
  tenantId: string;
  metric: MetricType;
  currentUsage: number;
  limit: number;
  overageAmount: number;
  timestamp: string;
  policy: OveragePolicy;
  charged: boolean;
  chargeAmount: number;
}

export interface OverageInvoiceItem {
  metric: MetricType;
  overageUnits: number;
  unitPrice: number;
  totalCharge: number;
  periodStart: string;
  periodEnd: string;
}

export interface OverageSummary {
  tenantId: string;
  period: string;
  totalOverageCharges: number;
  events: OverageEvent[];
  lineItems: OverageInvoiceItem[];
  policy: OveragePolicy;
}

export interface TenantOverageConfig {
  tenantId: string;
  policy: OveragePolicy;
  maxMonthlyOverageCharge: number;
  autoUpgradeThreshold?: number; // If overage exceeds this, suggest upgrade
  notifyAt: number[]; // percentages to notify (e.g., [100, 125, 150])
}

// ─────────────────────────────────────────────────────────────────
// Default Overage Rates
// ─────────────────────────────────────────────────────────────────

export const DEFAULT_OVERAGE_RATES: OverageRate[] = [
  { metric: "api_call", unitSize: 1000, unitPrice: 0.50, currency: "USD", maxOverageUnits: 100 },
  { metric: "agent_invocation", unitSize: 100, unitPrice: 2.00, currency: "USD", maxOverageUnits: 50 },
  { metric: "storage_write", unitSize: 1073741824, unitPrice: 0.25, currency: "USD", maxOverageUnits: 100 }, // per GB
  { metric: "webhook_delivery", unitSize: 1000, unitPrice: 1.00, currency: "USD", maxOverageUnits: 25 },
  { metric: "knowledge_query", unitSize: 1000, unitPrice: 0.75, currency: "USD", maxOverageUnits: 50 },
  { metric: "integration_call", unitSize: 500, unitPrice: 1.50, currency: "USD", maxOverageUnits: 20 },
];

export const DEFAULT_OVERAGE_POLICIES: Record<PlanTier, OveragePolicy> = {
  free: "block",
  pro: "allow_and_charge",
  enterprise: "allow_with_warning",
};

// ─────────────────────────────────────────────────────────────────
// Overage Manager
// ─────────────────────────────────────────────────────────────────

export class OverageManager {
  private rates: OverageRate[];
  private events: OverageEvent[] = [];
  private tenantConfigs: Map<string, TenantOverageConfig> = new Map();
  private listeners: Array<(event: OverageEvent) => void> = [];

  constructor(rates: OverageRate[] = DEFAULT_OVERAGE_RATES) {
    this.rates = rates;
  }

  configureTenant(config: TenantOverageConfig): void {
    this.tenantConfigs.set(config.tenantId, config);
  }

  getTenantConfig(tenantId: string): TenantOverageConfig | undefined {
    return this.tenantConfigs.get(tenantId);
  }

  checkOverage(
    tenantId: string,
    metric: MetricType,
    currentUsage: number,
    limit: number,
    planTier: PlanTier
  ): OverageEvent | null {
    if (limit === Infinity || currentUsage <= limit) return null;

    const overageAmount = currentUsage - limit;
    const config = this.tenantConfigs.get(tenantId);
    const policy = config?.policy ?? DEFAULT_OVERAGE_POLICIES[planTier];

    const rate = this.rates.find((r) => r.metric === metric);
    let chargeAmount = 0;
    let charged = false;

    if (policy === "allow_and_charge" && rate) {
      const units = Math.ceil(overageAmount / rate.unitSize);
      const cappedUnits = Math.min(units, rate.maxOverageUnits);
      chargeAmount = cappedUnits * rate.unitPrice;

      // Check monthly cap
      if (config?.maxMonthlyOverageCharge) {
        const existingCharges = this.getMonthlyCharges(tenantId);
        const remainingBudget = config.maxMonthlyOverageCharge - existingCharges;
        chargeAmount = Math.min(chargeAmount, Math.max(0, remainingBudget));
      }

      charged = chargeAmount > 0;
    }

    const event: OverageEvent = {
      id: `overage_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tenantId,
      metric,
      currentUsage,
      limit,
      overageAmount,
      timestamp: new Date().toISOString(),
      policy,
      charged,
      chargeAmount,
    };

    this.events.push(event);
    this.notifyListeners(event);
    return event;
  }

  getOverageEvents(tenantId: string, periodStart?: string, periodEnd?: string): OverageEvent[] {
    return this.events.filter((e) => {
      if (e.tenantId !== tenantId) return false;
      if (periodStart && new Date(e.timestamp) < new Date(periodStart)) return false;
      if (periodEnd && new Date(e.timestamp) > new Date(periodEnd)) return false;
      return true;
    });
  }

  generateOverageSummary(tenantId: string, periodStart: string, periodEnd: string): OverageSummary {
    const events = this.getOverageEvents(tenantId, periodStart, periodEnd);
    const config = this.tenantConfigs.get(tenantId);

    // Group by metric for line items
    const metricGroups = new Map<MetricType, OverageEvent[]>();
    for (const event of events) {
      const existing = metricGroups.get(event.metric) ?? [];
      existing.push(event);
      metricGroups.set(event.metric, existing);
    }

    const lineItems: OverageInvoiceItem[] = [];
    for (const [metric, metricEvents] of metricGroups) {
      const rate = this.rates.find((r) => r.metric === metric);
      if (!rate) continue;

      const totalOverage = metricEvents.reduce((sum, e) => sum + e.overageAmount, 0);
      const units = Math.ceil(totalOverage / rate.unitSize);
      const cappedUnits = Math.min(units, rate.maxOverageUnits);

      lineItems.push({
        metric,
        overageUnits: cappedUnits,
        unitPrice: rate.unitPrice,
        totalCharge: cappedUnits * rate.unitPrice,
        periodStart,
        periodEnd,
      });
    }

    const totalOverageCharges = lineItems.reduce((sum, item) => sum + item.totalCharge, 0);

    return {
      tenantId,
      period: `${periodStart} - ${periodEnd}`,
      totalOverageCharges,
      events,
      lineItems,
      policy: config?.policy ?? "block",
    };
  }

  shouldBlockRequest(tenantId: string, metric: MetricType, planTier: PlanTier): boolean {
    const config = this.tenantConfigs.get(tenantId);
    const policy = config?.policy ?? DEFAULT_OVERAGE_POLICIES[planTier];
    return policy === "block";
  }

  shouldThrottle(tenantId: string, metric: MetricType, planTier: PlanTier): boolean {
    const config = this.tenantConfigs.get(tenantId);
    const policy = config?.policy ?? DEFAULT_OVERAGE_POLICIES[planTier];
    return policy === "throttle";
  }

  shouldSuggestUpgrade(tenantId: string): boolean {
    const config = this.tenantConfigs.get(tenantId);
    if (!config?.autoUpgradeThreshold) return false;

    const monthlyCharges = this.getMonthlyCharges(tenantId);
    return monthlyCharges >= config.autoUpgradeThreshold;
  }

  getOverageRate(metric: MetricType): OverageRate | undefined {
    return this.rates.find((r) => r.metric === metric);
  }

  getAllRates(): OverageRate[] {
    return [...this.rates];
  }

  onOverage(listener: (event: OverageEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getMonthlyCharges(tenantId: string): number {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const events = this.getOverageEvents(tenantId, monthStart);
    return events.reduce((sum, e) => sum + e.chargeAmount, 0);
  }

  private notifyListeners(event: OverageEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Listener errors should not break overage handling
      }
    }
  }
}

export function createOverageManager(rates?: OverageRate[]): OverageManager {
  return new OverageManager(rates);
}
