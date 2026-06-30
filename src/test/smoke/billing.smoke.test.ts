/**
 * D3VONN Billing + Usage Metering v1 — Smoke Tests
 *
 * Validates plan definitions, usage metering, billing cycles,
 * usage limits enforcement, and overage handling.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  PlanRegistry,
  createPlanRegistry,
  FREE_PLAN,
  PRO_PLAN,
  ENTERPRISE_PLAN,
  PLANS,
} from "../../../shared/billing/plans";
import {
  UsageMeter,
  createUsageMeter,
} from "../../../shared/billing/metering";
import {
  BillingCycleManager,
  createBillingCycleManager,
} from "../../../shared/billing/billing-cycle";
import {
  UsageLimitEnforcer,
  createUsageLimitEnforcer,
} from "../../../shared/billing/usage-limits";
import {
  OverageManager,
  createOverageManager,
  DEFAULT_OVERAGE_RATES,
  DEFAULT_OVERAGE_POLICIES,
} from "../../../shared/billing/overage";
import { bootstrapBilling } from "../../../shared/billing";

// ─────────────────────────────────────────────────────────────────
// Plan Definitions
// ─────────────────────────────────────────────────────────────────

describe("Billing Smoke: Plan Definitions", () => {
  it("should define 3 plan tiers", () => {
    expect(PLANS).toHaveLength(3);
    expect(PLANS.map((p) => p.tier)).toEqual(["free", "pro", "enterprise"]);
  });

  it("should have correct Free plan limits", () => {
    expect(FREE_PLAN.tier).toBe("free");
    expect(FREE_PLAN.pricing.monthly).toBe(0);
    expect(FREE_PLAN.limits.apiCallsPerMonth).toBeLessThan(PRO_PLAN.limits.apiCallsPerMonth);
    expect(FREE_PLAN.limits.agentInvocationsPerMonth).toBeLessThan(PRO_PLAN.limits.agentInvocationsPerMonth);
  });

  it("should have correct Pro plan pricing", () => {
    expect(PRO_PLAN.tier).toBe("pro");
    expect(PRO_PLAN.pricing.monthly).toBeGreaterThan(0);
    expect(PRO_PLAN.pricing.annual).toBeLessThan(PRO_PLAN.pricing.monthly * 12);
  });

  it("should have Enterprise plan with highest limits", () => {
    expect(ENTERPRISE_PLAN.tier).toBe("enterprise");
    expect(ENTERPRISE_PLAN.limits.apiCallsPerMonth).toBeGreaterThan(PRO_PLAN.limits.apiCallsPerMonth);
    expect(ENTERPRISE_PLAN.limits.agentInvocationsPerMonth).toBeGreaterThan(PRO_PLAN.limits.agentInvocationsPerMonth);
  });

  it("should create a plan registry with all plans", () => {
    const registry = createPlanRegistry();
    expect(registry.getPlanByTier("free")).toBeDefined();
    expect(registry.getPlanByTier("pro")).toBeDefined();
    expect(registry.getPlanByTier("enterprise")).toBeDefined();
  });

  it("should support plan comparison", () => {
    const registry = createPlanRegistry();
    const allPlans = registry.getAllPlans();
    expect(allPlans.length).toBeGreaterThanOrEqual(3);
  });
});

// ─────────────────────────────────────────────────────────────────
// Usage Metering
// ─────────────────────────────────────────────────────────────────

describe("Billing Smoke: Usage Metering", () => {
  let meter: UsageMeter;

  beforeEach(() => {
    meter = createUsageMeter();
  });

  it("should record usage events", () => {
    meter.record({ tenantId: "t1", workspaceId: "ws1", metric: "api_call" });
    meter.record({ tenantId: "t1", workspaceId: "ws1", metric: "api_call" });
    meter.record({ tenantId: "t1", workspaceId: "ws1", metric: "agent_invocation" });

    expect(meter.getRecordCount()).toBe(3);
  });

  it("should aggregate usage by tenant and workspace", () => {
    meter.record({ tenantId: "t1", workspaceId: "ws1", metric: "api_call", quantity: 100 });
    meter.record({ tenantId: "t1", workspaceId: "ws1", metric: "api_call", quantity: 50 });
    meter.record({ tenantId: "t1", workspaceId: "ws1", metric: "agent_invocation", quantity: 10 });

    const summary = meter.getUsage("t1", "ws1");
    expect(summary.metrics.api_call).toBe(150);
    expect(summary.metrics.agent_invocation).toBe(10);
  });

  it("should isolate usage between tenants", () => {
    meter.record({ tenantId: "t1", workspaceId: "ws1", metric: "api_call", quantity: 100 });
    meter.record({ tenantId: "t2", workspaceId: "ws2", metric: "api_call", quantity: 200 });

    const t1Summary = meter.getUsage("t1", "ws1");
    const t2Summary = meter.getUsage("t2", "ws2");
    expect(t1Summary.metrics.api_call).toBe(100);
    expect(t2Summary.metrics.api_call).toBe(200);
  });

  it("should support batch recording", () => {
    const records = meter.recordBatch([
      { tenantId: "t1", workspaceId: "ws1", metric: "api_call", quantity: 10 },
      { tenantId: "t1", workspaceId: "ws1", metric: "api_call", quantity: 20 },
      { tenantId: "t1", workspaceId: "ws1", metric: "storage_write", quantity: 5 },
    ]);

    expect(records).toHaveLength(3);
    expect(meter.getRecordCount()).toBe(3);
  });

  it("should support usage listeners", () => {
    const events: string[] = [];
    meter.onRecord((record) => events.push(record.metric));

    meter.record({ tenantId: "t1", workspaceId: "ws1", metric: "api_call" });
    meter.record({ tenantId: "t1", workspaceId: "ws1", metric: "webhook_delivery" });

    expect(events).toEqual(["api_call", "webhook_delivery"]);
  });

  it("should provide usage snapshot", () => {
    meter.record({ tenantId: "t1", workspaceId: "ws1", metric: "api_call", quantity: 500 });
    meter.record({ tenantId: "t1", workspaceId: "ws1", metric: "agent_invocation", quantity: 25 });

    const snapshot = meter.getSnapshot("t1", "ws1");
    expect(snapshot.apiCalls).toBe(500);
    expect(snapshot.agentInvocations).toBe(25);
  });

  it("should calculate usage percentages against limits", () => {
    meter.record({ tenantId: "t1", workspaceId: "ws1", metric: "api_call", quantity: 800 });

    const percentages = meter.getUsagePercentages("t1", "ws1", FREE_PLAN.limits);
    const apiCallPct = percentages.find((p) => p.metric === "API Calls");
    expect(apiCallPct).toBeDefined();
    expect(apiCallPct!.percentage).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────
// Billing Cycle Management
// ─────────────────────────────────────────────────────────────────

describe("Billing Smoke: Billing Cycles", () => {
  let billing: BillingCycleManager;

  beforeEach(() => {
    billing = createBillingCycleManager();
  });

  it("should create a subscription", () => {
    const sub = billing.createSubscription({
      tenantId: "t1",
      planId: "pro",
      planTier: "pro",
      billingInterval: "monthly",
    });

    expect(sub.id).toBeDefined();
    expect(sub.status).toBe("active");
    expect(sub.planTier).toBe("pro");
  });

  it("should create a trial subscription", () => {
    const sub = billing.createSubscription({
      tenantId: "t1",
      planId: "pro",
      planTier: "pro",
      billingInterval: "monthly",
      trialDays: 14,
    });

    expect(sub.status).toBe("trialing");
    expect(sub.trialEnd).toBeDefined();
  });

  it("should cancel a subscription", () => {
    const sub = billing.createSubscription({
      tenantId: "t1",
      planId: "pro",
      planTier: "pro",
      billingInterval: "monthly",
    });

    const canceled = billing.cancelSubscription(sub.id, true);
    expect(canceled).not.toBeNull();
    expect(canceled!.status).toBe("canceled");
  });

  it("should upgrade a plan", () => {
    const sub = billing.createSubscription({
      tenantId: "t1",
      planId: "pro",
      planTier: "pro",
      billingInterval: "monthly",
    });

    const upgraded = billing.upgradePlan(sub.id, "enterprise", "enterprise");
    expect(upgraded).not.toBeNull();
    expect(upgraded!.planTier).toBe("enterprise");
  });

  it("should create and pay invoices", () => {
    const sub = billing.createSubscription({
      tenantId: "t1",
      planId: "pro",
      planTier: "pro",
      billingInterval: "monthly",
    });

    const invoice = billing.createInvoice({
      tenantId: "t1",
      subscriptionId: sub.id,
      lineItems: [
        { description: "Pro Plan - Monthly", quantity: 1, unitPrice: 79, amount: 79, type: "subscription" },
      ],
    });

    expect(invoice.status).toBe("open");
    expect(invoice.amountDue).toBe(79);

    const paid = billing.payInvoice(invoice.id);
    expect(paid).not.toBeNull();
    expect(paid!.status).toBe("paid");
  });

  it("should emit billing events", () => {
    const events: string[] = [];
    billing.onEvent((event) => events.push(event.type));

    billing.createSubscription({
      tenantId: "t1",
      planId: "pro",
      planTier: "pro",
      billingInterval: "monthly",
    });

    expect(events).toContain("subscription.created");
  });

  it("should renew a subscription", () => {
    const sub = billing.createSubscription({
      tenantId: "t1",
      planId: "pro",
      planTier: "pro",
      billingInterval: "monthly",
    });

    const renewed = billing.renewSubscription(sub.id);
    expect(renewed).not.toBeNull();
    expect(renewed!.status).toBe("active");
  });

  it("should detect trial expiring soon", () => {
    const sub = billing.createSubscription({
      tenantId: "t1",
      planId: "pro",
      planTier: "pro",
      billingInterval: "monthly",
      trialDays: 2,
    });

    expect(billing.isTrialExpiring(sub.id, 3)).toBe(true);
    expect(billing.isTrialExpiring(sub.id, 1)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// Usage Limits
// ─────────────────────────────────────────────────────────────────

describe("Billing Smoke: Usage Limits", () => {
  let enforcer: UsageLimitEnforcer;

  beforeEach(() => {
    enforcer = createUsageLimitEnforcer();
  });

  it("should allow usage within limits", () => {
    const result = enforcer.checkLimit("t1", "api_call", 500, FREE_PLAN.limits);
    expect(result.result).toBe("allowed");
    expect(result.remaining).toBeGreaterThan(0);
  });

  it("should warn when approaching limits", () => {
    const limit = FREE_PLAN.limits.apiCallsPerMonth;
    const usage = Math.floor(limit * 0.92); // 92% usage
    const result = enforcer.checkLimit("t1", "api_call", usage, FREE_PLAN.limits);
    expect(result.result).toBe("warning");
  });

  it("should block when hard limit exceeded", () => {
    const limit = FREE_PLAN.limits.apiCallsPerMonth;
    const result = enforcer.checkLimit("t1", "api_call", limit + 100, FREE_PLAN.limits);
    expect(result.result).toBe("hard_limit");
  });

  it("should allow unlimited metrics", () => {
    const result = enforcer.checkLimit("t1", "event_published", 999999, FREE_PLAN.limits);
    expect(result.result).toBe("allowed");
  });

  it("should support limit overrides", () => {
    enforcer.addOverride({
      tenantId: "t1",
      resource: "apiCallsPerMonth",
      overrideLimit: 100000,
      reason: "VIP customer",
      createdBy: "admin",
      createdAt: new Date().toISOString(),
    });

    const overrides = enforcer.getOverrides("t1");
    expect(overrides).toHaveLength(1);

    // With override, 50000 should be allowed even on free plan
    const result = enforcer.checkLimit("t1", "api_call", 50000, FREE_PLAN.limits);
    expect(result.result).toBe("allowed");
  });

  it("should support grace periods", () => {
    enforcer.startGracePeriod("t1", "api_call");
    const limit = FREE_PLAN.limits.apiCallsPerMonth;
    const result = enforcer.checkLimit("t1", "api_call", limit + 100, FREE_PLAN.limits);
    // During grace period, should be soft_limit not hard_limit
    expect(result.result).toBe("soft_limit");
  });

  it("should track notifications", () => {
    const limit = FREE_PLAN.limits.apiCallsPerMonth;
    enforcer.checkLimit("t1", "api_call", limit + 100, FREE_PLAN.limits);

    const notifications = enforcer.getNotifications("t1");
    expect(notifications.length).toBeGreaterThan(0);
    expect(notifications[0].type).toBe("exceeded");
  });
});

// ─────────────────────────────────────────────────────────────────
// Overage Handling
// ─────────────────────────────────────────────────────────────────

describe("Billing Smoke: Overage Handling", () => {
  let overage: OverageManager;

  beforeEach(() => {
    overage = createOverageManager();
  });

  it("should define default overage rates", () => {
    expect(DEFAULT_OVERAGE_RATES.length).toBeGreaterThan(0);
    const apiRate = DEFAULT_OVERAGE_RATES.find((r) => r.metric === "api_call");
    expect(apiRate).toBeDefined();
    expect(apiRate!.unitPrice).toBeGreaterThan(0);
  });

  it("should define default policies per tier", () => {
    expect(DEFAULT_OVERAGE_POLICIES.free).toBe("block");
    expect(DEFAULT_OVERAGE_POLICIES.pro).toBe("allow_and_charge");
    expect(DEFAULT_OVERAGE_POLICIES.enterprise).toBe("allow_with_warning");
  });

  it("should detect overage and create event", () => {
    const event = overage.checkOverage("t1", "api_call", 1500, 1000, "pro");
    expect(event).not.toBeNull();
    expect(event!.overageAmount).toBe(500);
    expect(event!.charged).toBe(true);
    expect(event!.chargeAmount).toBeGreaterThan(0);
  });

  it("should not create event when within limits", () => {
    const event = overage.checkOverage("t1", "api_call", 500, 1000, "pro");
    expect(event).toBeNull();
  });

  it("should block on free tier", () => {
    expect(overage.shouldBlockRequest("t1", "api_call", "free")).toBe(true);
    expect(overage.shouldBlockRequest("t1", "api_call", "pro")).toBe(false);
  });

  it("should configure per-tenant overage policy", () => {
    overage.configureTenant({
      tenantId: "t1",
      policy: "throttle",
      maxMonthlyOverageCharge: 100,
      notifyAt: [100, 125, 150],
    });

    const config = overage.getTenantConfig("t1");
    expect(config).toBeDefined();
    expect(config!.policy).toBe("throttle");
  });

  it("should generate overage summary", () => {
    overage.checkOverage("t1", "api_call", 1500, 1000, "pro");
    overage.checkOverage("t1", "agent_invocation", 600, 500, "pro");

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const summary = overage.generateOverageSummary("t1", monthStart, monthEnd);
    expect(summary.events.length).toBe(2);
    expect(summary.totalOverageCharges).toBeGreaterThan(0);
    expect(summary.lineItems.length).toBe(2);
  });

  it("should respect monthly charge cap", () => {
    overage.configureTenant({
      tenantId: "t1",
      policy: "allow_and_charge",
      maxMonthlyOverageCharge: 5,
      notifyAt: [100],
    });

    // First overage should charge
    const event1 = overage.checkOverage("t1", "api_call", 11000, 1000, "pro");
    expect(event1).not.toBeNull();

    // After cap is hit, charges should be capped
    const monthlyCharges = overage.getMonthlyCharges("t1");
    expect(monthlyCharges).toBeLessThanOrEqual(5);
  });

  it("should suggest upgrade when threshold exceeded", () => {
    overage.configureTenant({
      tenantId: "t1",
      policy: "allow_and_charge",
      maxMonthlyOverageCharge: 100,
      autoUpgradeThreshold: 5,
      notifyAt: [100],
    });

    // Generate enough overage to exceed threshold
    overage.checkOverage("t1", "api_call", 20000, 1000, "pro");

    expect(overage.shouldSuggestUpgrade("t1")).toBe(true);
  });

  it("should support overage event listeners", () => {
    const events: string[] = [];
    overage.onOverage((event) => events.push(event.metric));

    overage.checkOverage("t1", "api_call", 1500, 1000, "pro");
    expect(events).toContain("api_call");
  });
});

// ─────────────────────────────────────────────────────────────────
// Bootstrap Integration
// ─────────────────────────────────────────────────────────────────

describe("Billing Smoke: Bootstrap Integration", () => {
  it("should bootstrap the full billing stack", () => {
    const stack = bootstrapBilling();
    expect(stack.plans).toBeInstanceOf(PlanRegistry);
    expect(stack.meter).toBeInstanceOf(UsageMeter);
    expect(stack.billing).toBeInstanceOf(BillingCycleManager);
    expect(stack.limits).toBeInstanceOf(UsageLimitEnforcer);
    expect(stack.overage).toBeInstanceOf(OverageManager);
  });

  it("should support end-to-end billing flow", () => {
    const stack = bootstrapBilling();

    // 1. Create subscription
    const sub = stack.billing.createSubscription({
      tenantId: "t1",
      planId: "pro",
      planTier: "pro",
      billingInterval: "monthly",
    });
    expect(sub.status).toBe("active");

    // 2. Record usage
    stack.meter.record({ tenantId: "t1", workspaceId: "ws1", metric: "api_call", quantity: 100 });
    stack.meter.record({ tenantId: "t1", workspaceId: "ws1", metric: "agent_invocation", quantity: 10 });

    // 3. Check limits
    const plan = stack.plans.getPlanByTier("pro");
    const check = stack.limits.checkLimit("t1", "api_call", 100, plan!.limits);
    expect(check.result).toBe("allowed");

    // 4. Verify no overage
    const overageEvent = stack.overage.checkOverage("t1", "api_call", 100, plan!.limits.apiCallsPerMonth, "pro");
    expect(overageEvent).toBeNull();
  });
});
