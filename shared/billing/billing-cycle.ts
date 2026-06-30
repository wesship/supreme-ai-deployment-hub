/**
 * D3VONN Billing — Billing Cycle Management
 *
 * Manages subscription lifecycle, billing periods, invoicing,
 * plan upgrades/downgrades, and trial management.
 *
 * @module shared/billing/billing-cycle
 * @version 1.0.0
 */

import type { PlanTier, BillingInterval } from "./plans";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "paused"
  | "expired";

export type InvoiceStatus = "draft" | "open" | "paid" | "void" | "uncollectible";

export interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  planTier: PlanTier;
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialStart?: string;
  trialEnd?: string;
  canceledAt?: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface Invoice {
  id: string;
  tenantId: string;
  subscriptionId: string;
  status: InvoiceStatus;
  amountDue: number;
  amountPaid: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  lineItems: InvoiceLineItem[];
  dueDate: string;
  paidAt?: string;
  createdAt: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  type: "subscription" | "overage" | "addon" | "credit";
}

export interface BillingEvent {
  id: string;
  tenantId: string;
  type: BillingEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

export type BillingEventType =
  | "subscription.created"
  | "subscription.updated"
  | "subscription.canceled"
  | "subscription.renewed"
  | "subscription.trial_ending"
  | "invoice.created"
  | "invoice.paid"
  | "invoice.past_due"
  | "plan.upgraded"
  | "plan.downgraded"
  | "overage.triggered"
  | "payment.failed";

// ─────────────────────────────────────────────────────────────────
// Billing Cycle Manager
// ─────────────────────────────────────────────────────────────────

export class BillingCycleManager {
  private subscriptions: Map<string, Subscription> = new Map();
  private invoices: Invoice[] = [];
  private events: BillingEvent[] = [];
  private eventListeners: Array<(event: BillingEvent) => void> = [];

  createSubscription(params: {
    tenantId: string;
    planId: string;
    planTier: PlanTier;
    billingInterval: BillingInterval;
    trialDays?: number;
  }): Subscription {
    const now = new Date();
    const periodEnd = new Date(now);
    if (params.billingInterval === "monthly") {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    const isTrialing = (params.trialDays ?? 0) > 0;
    const trialEnd = isTrialing
      ? new Date(now.getTime() + (params.trialDays! * 86400000)).toISOString()
      : undefined;

    const subscription: Subscription = {
      id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tenantId: params.tenantId,
      planId: params.planId,
      planTier: params.planTier,
      status: isTrialing ? "trialing" : "active",
      billingInterval: params.billingInterval,
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      trialStart: isTrialing ? now.toISOString() : undefined,
      trialEnd,
      cancelAtPeriodEnd: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      metadata: {},
    };

    this.subscriptions.set(subscription.id, subscription);
    this.emitEvent(params.tenantId, "subscription.created", { subscriptionId: subscription.id });
    return subscription;
  }

  getSubscription(subscriptionId: string): Subscription | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  getSubscriptionByTenant(tenantId: string): Subscription | undefined {
    return [...this.subscriptions.values()].find(
      (s) => s.tenantId === tenantId && s.status !== "canceled" && s.status !== "expired"
    );
  }

  renewSubscription(subscriptionId: string): Subscription | null {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub || sub.status === "canceled" || sub.status === "expired") return null;

    const now = new Date();
    const newEnd = new Date(now);
    if (sub.billingInterval === "monthly") {
      newEnd.setMonth(newEnd.getMonth() + 1);
    } else {
      newEnd.setFullYear(newEnd.getFullYear() + 1);
    }

    sub.currentPeriodStart = now.toISOString();
    sub.currentPeriodEnd = newEnd.toISOString();
    sub.status = "active";
    sub.updatedAt = now.toISOString();

    this.emitEvent(sub.tenantId, "subscription.renewed", { subscriptionId });
    return sub;
  }

  cancelSubscription(subscriptionId: string, immediate: boolean = false): Subscription | null {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return null;

    if (immediate) {
      sub.status = "canceled";
      sub.canceledAt = new Date().toISOString();
    } else {
      sub.cancelAtPeriodEnd = true;
    }
    sub.updatedAt = new Date().toISOString();

    this.emitEvent(sub.tenantId, "subscription.canceled", { subscriptionId, immediate });
    return sub;
  }

  upgradePlan(subscriptionId: string, newPlanId: string, newTier: PlanTier): Subscription | null {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return null;

    const oldPlanId = sub.planId;
    sub.planId = newPlanId;
    sub.planTier = newTier;
    sub.updatedAt = new Date().toISOString();

    this.emitEvent(sub.tenantId, "plan.upgraded", { subscriptionId, from: oldPlanId, to: newPlanId });
    return sub;
  }

  downgradePlan(subscriptionId: string, newPlanId: string, newTier: PlanTier): Subscription | null {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return null;

    const oldPlanId = sub.planId;
    sub.planId = newPlanId;
    sub.planTier = newTier;
    sub.cancelAtPeriodEnd = false;
    sub.updatedAt = new Date().toISOString();

    this.emitEvent(sub.tenantId, "plan.downgraded", { subscriptionId, from: oldPlanId, to: newPlanId });
    return sub;
  }

  createInvoice(params: {
    tenantId: string;
    subscriptionId: string;
    lineItems: InvoiceLineItem[];
    dueDate?: string;
  }): Invoice {
    const now = new Date();
    const totalDue = params.lineItems.reduce((sum, item) => sum + item.amount, 0);

    const invoice: Invoice = {
      id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tenantId: params.tenantId,
      subscriptionId: params.subscriptionId,
      status: "open",
      amountDue: totalDue,
      amountPaid: 0,
      currency: "USD",
      periodStart: now.toISOString(),
      periodEnd: new Date(now.getTime() + 30 * 86400000).toISOString(),
      lineItems: params.lineItems,
      dueDate: params.dueDate ?? new Date(now.getTime() + 30 * 86400000).toISOString(),
      createdAt: now.toISOString(),
    };

    this.invoices.push(invoice);
    this.emitEvent(params.tenantId, "invoice.created", { invoiceId: invoice.id });
    return invoice;
  }

  payInvoice(invoiceId: string): Invoice | null {
    const invoice = this.invoices.find((i) => i.id === invoiceId);
    if (!invoice || invoice.status === "paid") return null;

    invoice.status = "paid";
    invoice.amountPaid = invoice.amountDue;
    invoice.paidAt = new Date().toISOString();

    this.emitEvent(invoice.tenantId, "invoice.paid", { invoiceId });
    return invoice;
  }

  getInvoices(tenantId: string): Invoice[] {
    return this.invoices.filter((i) => i.tenantId === tenantId);
  }

  getEvents(tenantId?: string): BillingEvent[] {
    if (!tenantId) return [...this.events];
    return this.events.filter((e) => e.tenantId === tenantId);
  }

  onEvent(listener: (event: BillingEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      this.eventListeners = this.eventListeners.filter((l) => l !== listener);
    };
  }

  getDaysUntilRenewal(subscriptionId: string): number {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return -1;
    const end = new Date(sub.currentPeriodEnd).getTime();
    const now = Date.now();
    return Math.max(0, Math.ceil((end - now) / 86400000));
  }

  isTrialExpiring(subscriptionId: string, withinDays: number = 3): boolean {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub || sub.status !== "trialing" || !sub.trialEnd) return false;
    const trialEnd = new Date(sub.trialEnd).getTime();
    const threshold = Date.now() + withinDays * 86400000;
    return trialEnd <= threshold;
  }

  private emitEvent(tenantId: string, type: BillingEventType, data: Record<string, unknown>): void {
    const event: BillingEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tenantId,
      type,
      timestamp: new Date().toISOString(),
      data,
    };
    this.events.push(event);
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch {
        // Listener errors should not break billing
      }
    }
  }
}

export function createBillingCycleManager(): BillingCycleManager {
  return new BillingCycleManager();
}
