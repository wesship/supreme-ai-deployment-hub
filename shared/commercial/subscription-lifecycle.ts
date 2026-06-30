/**
 * D3VONN Commercial Readiness — Subscription Lifecycle
 *
 * Full subscription management with trials, upgrades, downgrades,
 * cancellation, reactivation, and proration.
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "paused" | "cancelled" | "expired";
export type BillingInterval = "monthly" | "quarterly" | "annual";
export type ChangeType = "upgrade" | "downgrade" | "cancel" | "reactivate" | "pause" | "resume";

export interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEnd?: string;
  cancelledAt?: string;
  cancelAtPeriodEnd: boolean;
  quantity: number;
  pricePerUnit: number;
  discount?: SubscriptionDiscount;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionDiscount {
  id: string;
  type: "percentage" | "fixed";
  value: number;
  duration: "once" | "repeating" | "forever";
  remainingCycles?: number;
}

export interface SubscriptionChange {
  id: string;
  subscriptionId: string;
  type: ChangeType;
  fromPlan?: string;
  toPlan?: string;
  effectiveAt: string;
  proration: ProrationResult;
  reason?: string;
  initiatedBy: string;
  timestamp: string;
}

export interface ProrationResult {
  creditAmount: number;
  chargeAmount: number;
  netAmount: number;
  daysRemaining: number;
  daysInPeriod: number;
  description: string;
}

export interface SubscriptionEvent {
  type: "created" | "activated" | "trial_ending" | "renewed" | "upgraded" | "downgraded" | "paused" | "cancelled" | "expired" | "reactivated";
  subscriptionId: string;
  tenantId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────
// Subscription Manager
// ─────────────────────────────────────────────────────────────────

export class SubscriptionManager {
  private subscriptions: Map<string, Subscription> = new Map();
  private changes: SubscriptionChange[] = [];
  private events: SubscriptionEvent[] = [];

  // ─── Subscription CRUD ──────────────────────────────────────

  create(tenantId: string, planId: string, interval: BillingInterval, options?: { trialDays?: number; quantity?: number; pricePerUnit?: number; discount?: SubscriptionDiscount }): Subscription {
    const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();
    const periodEnd = this.calculatePeriodEnd(now, interval);
    const trialEnd = options?.trialDays ? new Date(now.getTime() + options.trialDays * 86400000).toISOString() : undefined;

    const subscription: Subscription = {
      id,
      tenantId,
      planId,
      status: trialEnd ? "trialing" : "active",
      billingInterval: interval,
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      trialEnd,
      cancelAtPeriodEnd: false,
      quantity: options?.quantity ?? 1,
      pricePerUnit: options?.pricePerUnit ?? 0,
      discount: options?.discount,
      metadata: {},
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    this.subscriptions.set(id, subscription);
    this.emitEvent("created", subscription);
    return subscription;
  }

  get(subscriptionId: string): Subscription | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  getByTenant(tenantId: string): Subscription | undefined {
    return [...this.subscriptions.values()].find((s) => s.tenantId === tenantId && s.status !== "cancelled" && s.status !== "expired");
  }

  // ─── Lifecycle Operations ───────────────────────────────────

  upgrade(subscriptionId: string, newPlanId: string, newPrice: number, initiatedBy: string): SubscriptionChange | null {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub || sub.status === "cancelled") return null;

    const proration = this.calculateProration(sub, newPrice);
    const change: SubscriptionChange = {
      id: `chg_${Date.now()}`,
      subscriptionId,
      type: "upgrade",
      fromPlan: sub.planId,
      toPlan: newPlanId,
      effectiveAt: new Date().toISOString(),
      proration,
      initiatedBy,
      timestamp: new Date().toISOString(),
    };

    sub.planId = newPlanId;
    sub.pricePerUnit = newPrice;
    sub.updatedAt = new Date().toISOString();

    this.changes.push(change);
    this.emitEvent("upgraded", sub);
    return change;
  }

  downgrade(subscriptionId: string, newPlanId: string, newPrice: number, initiatedBy: string): SubscriptionChange | null {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub || sub.status === "cancelled") return null;

    const proration = this.calculateProration(sub, newPrice);
    const change: SubscriptionChange = {
      id: `chg_${Date.now()}`,
      subscriptionId,
      type: "downgrade",
      fromPlan: sub.planId,
      toPlan: newPlanId,
      effectiveAt: sub.currentPeriodEnd, // Downgrade at period end
      proration,
      initiatedBy,
      timestamp: new Date().toISOString(),
    };

    this.changes.push(change);
    this.emitEvent("downgraded", sub);
    return change;
  }

  cancel(subscriptionId: string, atPeriodEnd: boolean, reason: string, initiatedBy: string): SubscriptionChange | null {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub || sub.status === "cancelled") return null;

    if (atPeriodEnd) {
      sub.cancelAtPeriodEnd = true;
    } else {
      sub.status = "cancelled";
      sub.cancelledAt = new Date().toISOString();
    }
    sub.updatedAt = new Date().toISOString();

    const change: SubscriptionChange = {
      id: `chg_${Date.now()}`,
      subscriptionId,
      type: "cancel",
      fromPlan: sub.planId,
      effectiveAt: atPeriodEnd ? sub.currentPeriodEnd : new Date().toISOString(),
      proration: { creditAmount: 0, chargeAmount: 0, netAmount: 0, daysRemaining: 0, daysInPeriod: 0, description: atPeriodEnd ? "Cancels at period end" : "Immediate cancellation" },
      reason,
      initiatedBy,
      timestamp: new Date().toISOString(),
    };

    this.changes.push(change);
    this.emitEvent("cancelled", sub);
    return change;
  }

  reactivate(subscriptionId: string, initiatedBy: string): SubscriptionChange | null {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub || (sub.status !== "cancelled" && !sub.cancelAtPeriodEnd)) return null;

    sub.status = "active";
    sub.cancelAtPeriodEnd = false;
    sub.cancelledAt = undefined;
    sub.updatedAt = new Date().toISOString();

    const change: SubscriptionChange = {
      id: `chg_${Date.now()}`,
      subscriptionId,
      type: "reactivate",
      effectiveAt: new Date().toISOString(),
      proration: { creditAmount: 0, chargeAmount: 0, netAmount: 0, daysRemaining: 0, daysInPeriod: 0, description: "Subscription reactivated" },
      initiatedBy,
      timestamp: new Date().toISOString(),
    };

    this.changes.push(change);
    this.emitEvent("reactivated", sub);
    return change;
  }

  pause(subscriptionId: string, initiatedBy: string): SubscriptionChange | null {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub || sub.status !== "active") return null;

    sub.status = "paused";
    sub.updatedAt = new Date().toISOString();

    const change: SubscriptionChange = {
      id: `chg_${Date.now()}`,
      subscriptionId,
      type: "pause",
      effectiveAt: new Date().toISOString(),
      proration: { creditAmount: 0, chargeAmount: 0, netAmount: 0, daysRemaining: 0, daysInPeriod: 0, description: "Subscription paused" },
      initiatedBy,
      timestamp: new Date().toISOString(),
    };

    this.changes.push(change);
    this.emitEvent("paused", sub);
    return change;
  }

  // ─── Proration ──────────────────────────────────────────────

  private calculateProration(sub: Subscription, newPrice: number): ProrationResult {
    const now = Date.now();
    const periodStart = new Date(sub.currentPeriodStart).getTime();
    const periodEnd = new Date(sub.currentPeriodEnd).getTime();
    const daysInPeriod = Math.ceil((periodEnd - periodStart) / 86400000);
    const daysRemaining = Math.ceil((periodEnd - now) / 86400000);

    const dailyOldRate = sub.pricePerUnit / daysInPeriod;
    const dailyNewRate = newPrice / daysInPeriod;
    const creditAmount = dailyOldRate * daysRemaining;
    const chargeAmount = dailyNewRate * daysRemaining;
    const netAmount = chargeAmount - creditAmount;

    return {
      creditAmount: Math.round(creditAmount * 100) / 100,
      chargeAmount: Math.round(chargeAmount * 100) / 100,
      netAmount: Math.round(netAmount * 100) / 100,
      daysRemaining,
      daysInPeriod,
      description: `Prorated ${daysRemaining} days remaining in ${daysInPeriod}-day period`,
    };
  }

  // ─── Helpers ────────────────────────────────────────────────

  private calculatePeriodEnd(start: Date, interval: BillingInterval): Date {
    const end = new Date(start);
    switch (interval) {
      case "monthly": end.setMonth(end.getMonth() + 1); break;
      case "quarterly": end.setMonth(end.getMonth() + 3); break;
      case "annual": end.setFullYear(end.getFullYear() + 1); break;
    }
    return end;
  }

  private emitEvent(type: SubscriptionEvent["type"], sub: Subscription): void {
    this.events.push({ type, subscriptionId: sub.id, tenantId: sub.tenantId, data: { planId: sub.planId, status: sub.status }, timestamp: new Date().toISOString() });
  }

  // ─── Queries ────────────────────────────────────────────────

  getChanges(subscriptionId: string): SubscriptionChange[] {
    return this.changes.filter((c) => c.subscriptionId === subscriptionId);
  }

  getEvents(tenantId?: string): SubscriptionEvent[] {
    if (tenantId) return this.events.filter((e) => e.tenantId === tenantId);
    return [...this.events];
  }

  getStats(): { total: number; active: number; trialing: number; cancelled: number; mrr: number } {
    const subs = [...this.subscriptions.values()];
    const active = subs.filter((s) => s.status === "active");
    const mrr = active.reduce((sum, s) => {
      const monthly = s.billingInterval === "annual" ? s.pricePerUnit / 12 : s.billingInterval === "quarterly" ? s.pricePerUnit / 3 : s.pricePerUnit;
      return sum + monthly * s.quantity;
    }, 0);

    return {
      total: subs.length,
      active: active.length,
      trialing: subs.filter((s) => s.status === "trialing").length,
      cancelled: subs.filter((s) => s.status === "cancelled").length,
      mrr: Math.round(mrr * 100) / 100,
    };
  }
}

export function createSubscriptionManager(): SubscriptionManager {
  return new SubscriptionManager();
}
