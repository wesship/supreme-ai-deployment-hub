/**
 * D3VONN Enterprise Governance — Policy Builder
 *
 * Visual policy construction with rule engine, conditions,
 * actions, versioning, and enforcement.
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type PolicyScope = "global" | "tenant" | "team" | "user" | "resource";
export type PolicyEffect = "allow" | "deny" | "require_approval" | "log" | "alert";
export type ConditionOperator = "equals" | "not_equals" | "contains" | "not_contains" | "greater_than" | "less_than" | "in" | "not_in" | "matches" | "exists";

export interface Policy {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  version: number;
  scope: PolicyScope;
  enabled: boolean;
  rules: PolicyRule[];
  priority: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface PolicyRule {
  id: string;
  name: string;
  conditions: PolicyCondition[];
  conditionLogic: "all" | "any" | "none";
  effect: PolicyEffect;
  actions: PolicyAction[];
  exceptions: PolicyException[];
}

export interface PolicyCondition {
  field: string;
  operator: ConditionOperator;
  value: unknown;
  negate?: boolean;
}

export interface PolicyAction {
  type: "block" | "notify" | "log" | "require_mfa" | "quarantine" | "encrypt" | "redact" | "escalate";
  config: Record<string, unknown>;
}

export interface PolicyException {
  description: string;
  conditions: PolicyCondition[];
  expiresAt?: string;
  approvedBy: string;
}

export interface PolicyEvaluation {
  policyId: string;
  ruleName: string;
  effect: PolicyEffect;
  matched: boolean;
  conditions: { field: string; expected: unknown; actual: unknown; passed: boolean }[];
  actions: PolicyAction[];
  timestamp: string;
}

export interface PolicyVersion {
  policyId: string;
  version: number;
  policy: Policy;
  changedBy: string;
  changeReason: string;
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────
// Policy Builder
// ─────────────────────────────────────────────────────────────────

export class PolicyBuilder {
  private policies: Map<string, Policy> = new Map();
  private versions: PolicyVersion[] = [];
  private evaluationLog: PolicyEvaluation[] = [];

  // ─── Policy CRUD ────────────────────────────────────────────

  createPolicy(policy: Omit<Policy, "version" | "createdAt" | "updatedAt">): Policy {
    const fullPolicy: Policy = {
      ...policy,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.policies.set(fullPolicy.id, fullPolicy);
    this.versions.push({
      policyId: fullPolicy.id,
      version: 1,
      policy: { ...fullPolicy },
      changedBy: policy.createdBy,
      changeReason: "Initial creation",
      timestamp: fullPolicy.createdAt,
    });
    return fullPolicy;
  }

  getPolicy(policyId: string): Policy | undefined {
    return this.policies.get(policyId);
  }

  listPolicies(tenantId?: string, scope?: PolicyScope): Policy[] {
    let policies = [...this.policies.values()];
    if (tenantId) policies = policies.filter((p) => p.tenantId === tenantId);
    if (scope) policies = policies.filter((p) => p.scope === scope);
    return policies.sort((a, b) => b.priority - a.priority);
  }

  updatePolicy(policyId: string, updates: Partial<Policy>, changedBy: string, reason: string): Policy | null {
    const policy = this.policies.get(policyId);
    if (!policy) return null;

    Object.assign(policy, updates, {
      version: policy.version + 1,
      updatedAt: new Date().toISOString(),
    });

    this.versions.push({
      policyId,
      version: policy.version,
      policy: { ...policy },
      changedBy,
      changeReason: reason,
      timestamp: policy.updatedAt,
    });

    return policy;
  }

  deletePolicy(policyId: string): boolean {
    return this.policies.delete(policyId);
  }

  // ─── Rule Building ──────────────────────────────────────────

  addRule(policyId: string, rule: PolicyRule): boolean {
    const policy = this.policies.get(policyId);
    if (!policy) return false;
    policy.rules.push(rule);
    policy.updatedAt = new Date().toISOString();
    return true;
  }

  removeRule(policyId: string, ruleId: string): boolean {
    const policy = this.policies.get(policyId);
    if (!policy) return false;
    policy.rules = policy.rules.filter((r) => r.id !== ruleId);
    policy.updatedAt = new Date().toISOString();
    return true;
  }

  // ─── Evaluation Engine ──────────────────────────────────────

  evaluate(context: Record<string, unknown>, tenantId: string): PolicyEvaluation[] {
    const evaluations: PolicyEvaluation[] = [];
    const policies = this.listPolicies(tenantId).filter((p) => p.enabled);

    for (const policy of policies) {
      for (const rule of policy.rules) {
        const evaluation = this.evaluateRule(rule, context, policy.id);
        evaluations.push(evaluation);
        this.evaluationLog.push(evaluation);

        // Short-circuit on deny
        if (evaluation.matched && evaluation.effect === "deny") {
          return evaluations;
        }
      }
    }

    return evaluations;
  }

  private evaluateRule(rule: PolicyRule, context: Record<string, unknown>, policyId: string): PolicyEvaluation {
    const conditionResults = rule.conditions.map((cond) => {
      const actual = this.resolveField(context, cond.field);
      const passed = this.evaluateCondition(actual, cond.operator, cond.value, cond.negate);
      return { field: cond.field, expected: cond.value, actual, passed };
    });

    let matched: boolean;
    switch (rule.conditionLogic) {
      case "all": matched = conditionResults.every((c) => c.passed); break;
      case "any": matched = conditionResults.some((c) => c.passed); break;
      case "none": matched = conditionResults.every((c) => !c.passed); break;
    }

    // Check exceptions
    if (matched && rule.exceptions.length > 0) {
      for (const exception of rule.exceptions) {
        if (exception.expiresAt && new Date(exception.expiresAt) < new Date()) continue;
        const exceptionMatch = exception.conditions.every((cond) => {
          const actual = this.resolveField(context, cond.field);
          return this.evaluateCondition(actual, cond.operator, cond.value, cond.negate);
        });
        if (exceptionMatch) matched = false;
      }
    }

    return {
      policyId,
      ruleName: rule.name,
      effect: rule.effect,
      matched,
      conditions: conditionResults,
      actions: matched ? rule.actions : [],
      timestamp: new Date().toISOString(),
    };
  }

  private resolveField(context: Record<string, unknown>, field: string): unknown {
    const parts = field.split(".");
    let value: unknown = context;
    for (const part of parts) {
      if (value == null || typeof value !== "object") return undefined;
      value = (value as Record<string, unknown>)[part];
    }
    return value;
  }

  private evaluateCondition(actual: unknown, operator: ConditionOperator, expected: unknown, negate?: boolean): boolean {
    let result: boolean;
    switch (operator) {
      case "equals": result = actual === expected; break;
      case "not_equals": result = actual !== expected; break;
      case "contains": result = String(actual).includes(String(expected)); break;
      case "not_contains": result = !String(actual).includes(String(expected)); break;
      case "greater_than": result = Number(actual) > Number(expected); break;
      case "less_than": result = Number(actual) < Number(expected); break;
      case "in": result = Array.isArray(expected) && expected.includes(actual); break;
      case "not_in": result = Array.isArray(expected) && !expected.includes(actual); break;
      case "matches": result = new RegExp(String(expected)).test(String(actual)); break;
      case "exists": result = actual !== undefined && actual !== null; break;
      default: result = false;
    }
    return negate ? !result : result;
  }

  // ─── Versioning ─────────────────────────────────────────────

  getVersionHistory(policyId: string): PolicyVersion[] {
    return this.versions.filter((v) => v.policyId === policyId);
  }

  rollbackPolicy(policyId: string, version: number): Policy | null {
    const versionEntry = this.versions.find((v) => v.policyId === policyId && v.version === version);
    if (!versionEntry) return null;
    const restored = { ...versionEntry.policy, version: (this.policies.get(policyId)?.version ?? 0) + 1, updatedAt: new Date().toISOString() };
    this.policies.set(policyId, restored);
    return restored;
  }

  // ─── Evaluation Log ─────────────────────────────────────────

  getEvaluationLog(limit = 100): PolicyEvaluation[] {
    return this.evaluationLog.slice(-limit);
  }
}

export function createPolicyBuilder(): PolicyBuilder {
  return new PolicyBuilder();
}
