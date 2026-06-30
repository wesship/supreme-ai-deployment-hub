/**
 * D3VONN Billing — Plan Definitions
 *
 * Defines the SaaS plan tiers (Free, Pro, Enterprise) with their
 * feature gates, resource limits, and pricing structures.
 *
 * @module shared/billing/plans
 * @version 1.0.0
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type PlanTier = "free" | "pro" | "enterprise";
export type BillingInterval = "monthly" | "annual";
export type Currency = "USD" | "EUR" | "GBP";

export interface PlanPricing {
  monthly: number;
  annual: number;
  currency: Currency;
}

export interface ResourceLimits {
  apiCallsPerMonth: number;
  agentInvocationsPerMonth: number;
  storageGb: number;
  workspacesMax: number;
  membersMax: number;
  concurrentAgents: number;
  eventRetentionDays: number;
  knowledgeGraphNodes: number;
  customIntegrations: number;
  webhooksMax: number;
}

export interface FeatureGates {
  multiTenant: boolean;
  customAgents: boolean;
  advancedRbac: boolean;
  auditLog: boolean;
  sso: boolean;
  prioritySupport: boolean;
  sla: boolean;
  customDomain: boolean;
  whiteLabel: boolean;
  apiAccess: boolean;
  webhooks: boolean;
  dataExport: boolean;
  advancedAnalytics: boolean;
  hermesOrchestration: boolean;
  knowledgeGraph: boolean;
  deploymentRollback: boolean;
  secretsManagement: boolean;
  complianceReports: boolean;
}

export interface Plan {
  id: string;
  tier: PlanTier;
  name: string;
  description: string;
  pricing: PlanPricing;
  limits: ResourceLimits;
  features: FeatureGates;
  trialDays: number;
  popular: boolean;
  metadata: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────
// Default Plans
// ─────────────────────────────────────────────────────────────────

export const FREE_PLAN: Plan = {
  id: "plan_free",
  tier: "free",
  name: "Free",
  description: "Get started with D3VONN — perfect for individual developers and small experiments.",
  pricing: { monthly: 0, annual: 0, currency: "USD" },
  limits: {
    apiCallsPerMonth: 1_000,
    agentInvocationsPerMonth: 100,
    storageGb: 1,
    workspacesMax: 1,
    membersMax: 3,
    concurrentAgents: 2,
    eventRetentionDays: 7,
    knowledgeGraphNodes: 50,
    customIntegrations: 2,
    webhooksMax: 3,
  },
  features: {
    multiTenant: false,
    customAgents: false,
    advancedRbac: false,
    auditLog: false,
    sso: false,
    prioritySupport: false,
    sla: false,
    customDomain: false,
    whiteLabel: false,
    apiAccess: true,
    webhooks: true,
    dataExport: false,
    advancedAnalytics: false,
    hermesOrchestration: true,
    knowledgeGraph: true,
    deploymentRollback: false,
    secretsManagement: false,
    complianceReports: false,
  },
  trialDays: 0,
  popular: false,
  metadata: {},
};

export const PRO_PLAN: Plan = {
  id: "plan_pro",
  tier: "pro",
  name: "Pro",
  description: "For growing teams building production AI workflows with D3VONN.",
  pricing: { monthly: 79, annual: 790, currency: "USD" },
  limits: {
    apiCallsPerMonth: 50_000,
    agentInvocationsPerMonth: 5_000,
    storageGb: 50,
    workspacesMax: 10,
    membersMax: 25,
    concurrentAgents: 8,
    eventRetentionDays: 90,
    knowledgeGraphNodes: 500,
    customIntegrations: 10,
    webhooksMax: 25,
  },
  features: {
    multiTenant: true,
    customAgents: true,
    advancedRbac: true,
    auditLog: true,
    sso: false,
    prioritySupport: true,
    sla: false,
    customDomain: true,
    whiteLabel: false,
    apiAccess: true,
    webhooks: true,
    dataExport: true,
    advancedAnalytics: true,
    hermesOrchestration: true,
    knowledgeGraph: true,
    deploymentRollback: true,
    secretsManagement: true,
    complianceReports: false,
  },
  trialDays: 14,
  popular: true,
  metadata: {},
};

export const ENTERPRISE_PLAN: Plan = {
  id: "plan_enterprise",
  tier: "enterprise",
  name: "Enterprise",
  description: "Unlimited scale, dedicated support, and full platform control for large organizations.",
  pricing: { monthly: 499, annual: 4990, currency: "USD" },
  limits: {
    apiCallsPerMonth: Infinity,
    agentInvocationsPerMonth: Infinity,
    storageGb: 1000,
    workspacesMax: Infinity,
    membersMax: Infinity,
    concurrentAgents: 50,
    eventRetentionDays: 365,
    knowledgeGraphNodes: Infinity,
    customIntegrations: Infinity,
    webhooksMax: Infinity,
  },
  features: {
    multiTenant: true,
    customAgents: true,
    advancedRbac: true,
    auditLog: true,
    sso: true,
    prioritySupport: true,
    sla: true,
    customDomain: true,
    whiteLabel: true,
    apiAccess: true,
    webhooks: true,
    dataExport: true,
    advancedAnalytics: true,
    hermesOrchestration: true,
    knowledgeGraph: true,
    deploymentRollback: true,
    secretsManagement: true,
    complianceReports: true,
  },
  trialDays: 30,
  popular: false,
  metadata: {},
};

export const PLANS: Plan[] = [FREE_PLAN, PRO_PLAN, ENTERPRISE_PLAN];

// ─────────────────────────────────────────────────────────────────
// Plan Registry
// ─────────────────────────────────────────────────────────────────

export class PlanRegistry {
  private plans: Map<string, Plan>;

  constructor(plans: Plan[] = PLANS) {
    this.plans = new Map(plans.map((p) => [p.id, p]));
  }

  getPlan(planId: string): Plan | undefined {
    return this.plans.get(planId);
  }

  getPlanByTier(tier: PlanTier): Plan | undefined {
    return [...this.plans.values()].find((p) => p.tier === tier);
  }

  getAllPlans(): Plan[] {
    return [...this.plans.values()];
  }

  getFeatureAccess(planId: string, feature: keyof FeatureGates): boolean {
    const plan = this.plans.get(planId);
    if (!plan) return false;
    return plan.features[feature];
  }

  getLimit(planId: string, resource: keyof ResourceLimits): number {
    const plan = this.plans.get(planId);
    if (!plan) return 0;
    return plan.limits[resource];
  }

  comparePlans(planA: string, planB: string): {
    upgrades: string[];
    downgrades: string[];
    unchanged: string[];
  } {
    const a = this.plans.get(planA);
    const b = this.plans.get(planB);
    if (!a || !b) return { upgrades: [], downgrades: [], unchanged: [] };

    const upgrades: string[] = [];
    const downgrades: string[] = [];
    const unchanged: string[] = [];

    for (const key of Object.keys(a.limits) as (keyof ResourceLimits)[]) {
      if (b.limits[key] > a.limits[key]) upgrades.push(key);
      else if (b.limits[key] < a.limits[key]) downgrades.push(key);
      else unchanged.push(key);
    }

    for (const key of Object.keys(a.features) as (keyof FeatureGates)[]) {
      if (!a.features[key] && b.features[key]) upgrades.push(key);
      else if (a.features[key] && !b.features[key]) downgrades.push(key);
      else unchanged.push(key);
    }

    return { upgrades, downgrades, unchanged };
  }

  calculateAnnualSavings(planId: string): number {
    const plan = this.plans.get(planId);
    if (!plan) return 0;
    const monthlyTotal = plan.pricing.monthly * 12;
    return monthlyTotal - plan.pricing.annual;
  }
}

export function createPlanRegistry(plans?: Plan[]): PlanRegistry {
  return new PlanRegistry(plans);
}
