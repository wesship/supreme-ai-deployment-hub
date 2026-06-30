/**
 * D3VONN Billing + Usage Metering
 *
 * Complete SaaS billing system providing plan management, usage metering,
 * billing cycle management, tenant-aware usage limits, and overage handling.
 *
 * @module shared/billing
 * @version 1.0.0
 */

// ─────────────────────────────────────────────────────────────────
// Re-exports
// ─────────────────────────────────────────────────────────────────

export {
  PlanRegistry,
  createPlanRegistry,
  FREE_PLAN,
  PRO_PLAN,
  ENTERPRISE_PLAN,
  PLANS,
  type Plan,
  type PlanTier,
  type BillingInterval,
  type Currency,
  type PlanPricing,
  type ResourceLimits,
  type FeatureGates,
} from "./plans";

export {
  UsageMeter,
  createUsageMeter,
  type MetricType,
  type UsageRecord,
  type UsageSummary,
  type UsageSnapshot,
  type UsagePercentage,
} from "./metering";

export {
  BillingCycleManager,
  createBillingCycleManager,
  type Subscription,
  type SubscriptionStatus,
  type Invoice,
  type InvoiceStatus,
  type InvoiceLineItem,
  type BillingEvent,
  type BillingEventType,
} from "./billing-cycle";

export {
  UsageLimitEnforcer,
  createUsageLimitEnforcer,
  DEFAULT_LIMIT_CONFIG,
  type LimitCheckResult,
  type LimitCheckResponse,
  type QuotaStatus,
  type QuotaEntry,
  type LimitOverride,
  type LimitEnforcerConfig,
} from "./usage-limits";

export {
  OverageManager,
  createOverageManager,
  DEFAULT_OVERAGE_RATES,
  DEFAULT_OVERAGE_POLICIES,
  type OveragePolicy,
  type OverageRate,
  type OverageEvent,
  type OverageInvoiceItem,
  type OverageSummary,
  type TenantOverageConfig,
} from "./overage";

// ─────────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────────

import { PlanRegistry } from "./plans";
import { UsageMeter } from "./metering";
import { BillingCycleManager } from "./billing-cycle";
import { UsageLimitEnforcer } from "./usage-limits";
import { OverageManager } from "./overage";

export interface BillingStack {
  plans: PlanRegistry;
  meter: UsageMeter;
  billing: BillingCycleManager;
  limits: UsageLimitEnforcer;
  overage: OverageManager;
}

export function bootstrapBilling(): BillingStack {
  return {
    plans: new PlanRegistry(),
    meter: new UsageMeter(),
    billing: new BillingCycleManager(),
    limits: new UsageLimitEnforcer(),
    overage: new OverageManager(),
  };
}
