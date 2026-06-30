/**
 * D3VONN Customer Success — Feature Flags
 *
 * Progressive feature rollout with targeting rules,
 * percentage-based rollouts, A/B testing, and kill switches.
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type FlagStatus = "active" | "inactive" | "archived";
export type RolloutStrategy = "all" | "percentage" | "targeted" | "gradual" | "ring";

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  status: FlagStatus;
  defaultValue: boolean;
  rollout: RolloutConfig;
  targeting: TargetingRule[];
  variants?: FlagVariant[];
  killSwitch: boolean;
  createdAt: string;
  updatedAt: string;
  owner: string;
  tags: string[];
}

export interface RolloutConfig {
  strategy: RolloutStrategy;
  percentage: number; // 0-100
  rings?: RolloutRing[];
  schedule?: { startAt: string; endAt?: string };
}

export interface RolloutRing {
  name: string;
  percentage: number;
  activatedAt?: string;
}

export interface TargetingRule {
  id: string;
  attribute: string;
  operator: "equals" | "not_equals" | "contains" | "in" | "not_in" | "greater_than" | "less_than";
  value: unknown;
  serve: boolean | string; // boolean for on/off, string for variant key
}

export interface FlagVariant {
  key: string;
  name: string;
  value: unknown;
  weight: number; // 0-100, sum of all variants = 100
}

export interface FlagEvaluation {
  flagKey: string;
  userId: string;
  tenantId: string;
  value: boolean | unknown;
  variant?: string;
  reason: "default" | "targeting" | "rollout" | "kill_switch" | "disabled";
  timestamp: string;
}

export interface FlagAnalytics {
  flagKey: string;
  evaluations: number;
  trueCount: number;
  falseCount: number;
  variantDistribution: Record<string, number>;
  uniqueUsers: number;
}

// ─────────────────────────────────────────────────────────────────
// Feature Flag Engine
// ─────────────────────────────────────────────────────────────────

export class FeatureFlagEngine {
  private flags: Map<string, FeatureFlag> = new Map();
  private evaluationLog: FlagEvaluation[] = [];

  // ─── Flag Management ────────────────────────────────────────

  createFlag(flag: Omit<FeatureFlag, "createdAt" | "updatedAt">): FeatureFlag {
    const fullFlag: FeatureFlag = {
      ...flag,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.flags.set(flag.key, fullFlag);
    return fullFlag;
  }

  getFlag(key: string): FeatureFlag | undefined {
    return this.flags.get(key);
  }

  listFlags(status?: FlagStatus, tag?: string): FeatureFlag[] {
    let flags = [...this.flags.values()];
    if (status) flags = flags.filter((f) => f.status === status);
    if (tag) flags = flags.filter((f) => f.tags.includes(tag));
    return flags;
  }

  updateFlag(key: string, updates: Partial<FeatureFlag>): FeatureFlag | null {
    const flag = this.flags.get(key);
    if (!flag) return null;
    Object.assign(flag, updates, { updatedAt: new Date().toISOString() });
    return flag;
  }

  archiveFlag(key: string): boolean {
    const flag = this.flags.get(key);
    if (!flag) return false;
    flag.status = "archived";
    flag.updatedAt = new Date().toISOString();
    return true;
  }

  // ─── Kill Switch ────────────────────────────────────────────

  activateKillSwitch(key: string): boolean {
    const flag = this.flags.get(key);
    if (!flag) return false;
    flag.killSwitch = true;
    flag.updatedAt = new Date().toISOString();
    return true;
  }

  deactivateKillSwitch(key: string): boolean {
    const flag = this.flags.get(key);
    if (!flag) return false;
    flag.killSwitch = false;
    flag.updatedAt = new Date().toISOString();
    return true;
  }

  // ─── Evaluation ─────────────────────────────────────────────

  evaluate(key: string, context: { userId: string; tenantId: string; attributes: Record<string, unknown> }): FlagEvaluation {
    const flag = this.flags.get(key);
    const timestamp = new Date().toISOString();

    if (!flag || flag.status !== "active") {
      const evaluation: FlagEvaluation = { flagKey: key, userId: context.userId, tenantId: context.tenantId, value: false, reason: "disabled", timestamp };
      this.evaluationLog.push(evaluation);
      return evaluation;
    }

    // Kill switch check
    if (flag.killSwitch) {
      const evaluation: FlagEvaluation = { flagKey: key, userId: context.userId, tenantId: context.tenantId, value: false, reason: "kill_switch", timestamp };
      this.evaluationLog.push(evaluation);
      return evaluation;
    }

    // Targeting rules (highest priority)
    for (const rule of flag.targeting) {
      if (this.matchesRule(rule, context.attributes)) {
        const value = typeof rule.serve === "string" ? this.getVariantValue(flag, rule.serve) : rule.serve;
        const evaluation: FlagEvaluation = { flagKey: key, userId: context.userId, tenantId: context.tenantId, value, variant: typeof rule.serve === "string" ? rule.serve : undefined, reason: "targeting", timestamp };
        this.evaluationLog.push(evaluation);
        return evaluation;
      }
    }

    // Rollout strategy
    const rolloutValue = this.evaluateRollout(flag, context.userId);
    const evaluation: FlagEvaluation = { flagKey: key, userId: context.userId, tenantId: context.tenantId, value: rolloutValue, reason: "rollout", timestamp };
    this.evaluationLog.push(evaluation);
    return evaluation;
  }

  private matchesRule(rule: TargetingRule, attributes: Record<string, unknown>): boolean {
    const actual = attributes[rule.attribute];
    switch (rule.operator) {
      case "equals": return actual === rule.value;
      case "not_equals": return actual !== rule.value;
      case "contains": return String(actual).includes(String(rule.value));
      case "in": return Array.isArray(rule.value) && rule.value.includes(actual);
      case "not_in": return Array.isArray(rule.value) && !rule.value.includes(actual);
      case "greater_than": return Number(actual) > Number(rule.value);
      case "less_than": return Number(actual) < Number(rule.value);
      default: return false;
    }
  }

  private evaluateRollout(flag: FeatureFlag, userId: string): boolean {
    switch (flag.rollout.strategy) {
      case "all": return true;
      case "percentage": {
        const hash = this.hashUserId(userId, flag.key);
        return hash < flag.rollout.percentage;
      }
      case "gradual":
      case "ring":
      case "targeted":
      default:
        return flag.defaultValue;
    }
  }

  private hashUserId(userId: string, flagKey: string): number {
    const str = `${userId}:${flagKey}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash) % 100;
  }

  private getVariantValue(flag: FeatureFlag, variantKey: string): unknown {
    const variant = flag.variants?.find((v) => v.key === variantKey);
    return variant?.value ?? flag.defaultValue;
  }

  // ─── Analytics ──────────────────────────────────────────────

  getAnalytics(flagKey: string): FlagAnalytics {
    const evals = this.evaluationLog.filter((e) => e.flagKey === flagKey);
    const trueCount = evals.filter((e) => e.value === true).length;
    const uniqueUsers = new Set(evals.map((e) => e.userId)).size;

    const variantDist: Record<string, number> = {};
    for (const ev of evals) {
      if (ev.variant) {
        variantDist[ev.variant] = (variantDist[ev.variant] ?? 0) + 1;
      }
    }

    return {
      flagKey,
      evaluations: evals.length,
      trueCount,
      falseCount: evals.length - trueCount,
      variantDistribution: variantDist,
      uniqueUsers,
    };
  }

  // ─── Bulk Operations ────────────────────────────────────────

  setRolloutPercentage(key: string, percentage: number): boolean {
    const flag = this.flags.get(key);
    if (!flag) return false;
    flag.rollout.percentage = Math.max(0, Math.min(100, percentage));
    flag.rollout.strategy = "percentage";
    flag.updatedAt = new Date().toISOString();
    return true;
  }

  enableForTenant(key: string, tenantId: string): boolean {
    const flag = this.flags.get(key);
    if (!flag) return false;
    flag.targeting.push({
      id: `rule_${Date.now()}`,
      attribute: "tenantId",
      operator: "equals",
      value: tenantId,
      serve: true,
    });
    flag.updatedAt = new Date().toISOString();
    return true;
  }
}

export function createFeatureFlagEngine(): FeatureFlagEngine {
  return new FeatureFlagEngine();
}
