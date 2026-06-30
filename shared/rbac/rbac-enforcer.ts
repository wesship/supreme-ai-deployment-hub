/**
 * D3VONN Multi-Tenant Foundations — RBAC Enforcer
 *
 * Runtime enforcement of role-based access control.
 * Integrates with the tenant context to provide scoped
 * permission checks with audit logging.
 *
 * @module shared/rbac/rbac-enforcer
 * @version 1.0.0
 */

import { TenantContext } from "../tenancy/types";
import { RoleName, getPermissionsForRoles, isValidRole } from "./roles";
import { hasPermission, hasAllPermissions, hasAnyPermission } from "./permissions";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export interface AccessDecision {
  allowed: boolean;
  reason: string;
  permission: string;
  context: {
    tenantId: string;
    workspaceId: string;
    userId: string;
    roles: string[];
  };
  timestamp: string;
}

export interface AccessPolicy {
  name: string;
  description: string;
  resources: string[];
  actions: string[];
  conditions?: PolicyCondition[];
  effect: "allow" | "deny";
  priority: number;
}

export interface PolicyCondition {
  field: string;
  operator: "eq" | "neq" | "in" | "not_in" | "gt" | "lt" | "contains";
  value: unknown;
}

export interface RBACEnforcerOptions {
  /** Whether to log all access decisions */
  auditEnabled: boolean;
  /** Whether to enforce policies (false = permissive mode) */
  enforceMode: boolean;
  /** Custom policies to apply */
  policies?: AccessPolicy[];
  /** Callback for audit logging */
  onAccessDecision?: (decision: AccessDecision) => void;
}

// ─────────────────────────────────────────────────────────────────
// RBAC Enforcer
// ─────────────────────────────────────────────────────────────────

export class RBACEnforcer {
  private options: RBACEnforcerOptions;
  private policies: AccessPolicy[] = [];
  private decisionLog: AccessDecision[] = [];

  constructor(options?: Partial<RBACEnforcerOptions>) {
    this.options = {
      auditEnabled: options?.auditEnabled ?? true,
      enforceMode: options?.enforceMode ?? true,
      policies: options?.policies ?? [],
      onAccessDecision: options?.onAccessDecision,
    };
    this.policies = this.options.policies ?? [];
  }

  // ─── Core Enforcement ────────────────────────────────────────

  /**
   * Check if the given context has a specific permission.
   * Returns an AccessDecision with full audit trail.
   */
  check(context: TenantContext, permission: string): AccessDecision {
    // Resolve effective permissions from roles
    const validRoles = context.roles.filter(isValidRole) as RoleName[];
    const effectivePermissions = [
      ...getPermissionsForRoles(validRoles),
      ...context.permissions,
    ];

    // Check ALL deny policies (deny takes precedence)
    const denyPolicies = this.findMatchingPolicies(permission, "deny");
    for (const denyPolicy of denyPolicies) {
      if (this.evaluateConditions(denyPolicy.conditions, context)) {
        return this.createDecision(false, `Denied by policy: ${denyPolicy.name}`, permission, context);
      }
    }

    // Check permission
    const allowed = hasPermission(effectivePermissions, permission);
    const reason = allowed
      ? `Granted via roles: [${validRoles.join(", ")}]`
      : `Insufficient permissions. Required: ${permission}, Roles: [${validRoles.join(", ")}]`;

    return this.createDecision(allowed, reason, permission, context);
  }

  /**
   * Check if the context has ALL of the specified permissions.
   */
  checkAll(context: TenantContext, permissions: string[]): AccessDecision {
    const validRoles = context.roles.filter(isValidRole) as RoleName[];
    const effectivePermissions = [
      ...getPermissionsForRoles(validRoles),
      ...context.permissions,
    ];

    const allowed = hasAllPermissions(effectivePermissions, permissions);
    const reason = allowed
      ? `All permissions granted via roles: [${validRoles.join(", ")}]`
      : `Missing one or more permissions: [${permissions.join(", ")}]`;

    return this.createDecision(allowed, reason, permissions.join(", "), context);
  }

  /**
   * Check if the context has ANY of the specified permissions.
   */
  checkAny(context: TenantContext, permissions: string[]): AccessDecision {
    const validRoles = context.roles.filter(isValidRole) as RoleName[];
    const effectivePermissions = [
      ...getPermissionsForRoles(validRoles),
      ...context.permissions,
    ];

    const allowed = hasAnyPermission(effectivePermissions, permissions);
    const reason = allowed
      ? `Permission granted via roles: [${validRoles.join(", ")}]`
      : `None of required permissions available: [${permissions.join(", ")}]`;

    return this.createDecision(allowed, reason, permissions.join(" | "), context);
  }

  /**
   * Enforce a permission check. Throws if not allowed.
   */
  enforce(context: TenantContext, permission: string): void {
    const decision = this.check(context, permission);
    if (!decision.allowed && this.options.enforceMode) {
      throw new AccessDeniedError(decision);
    }
  }

  /**
   * Enforce ALL permissions. Throws if any are missing.
   */
  enforceAll(context: TenantContext, permissions: string[]): void {
    const decision = this.checkAll(context, permissions);
    if (!decision.allowed && this.options.enforceMode) {
      throw new AccessDeniedError(decision);
    }
  }

  // ─── Policy Management ───────────────────────────────────────

  /**
   * Add a custom access policy.
   */
  addPolicy(policy: AccessPolicy): void {
    this.policies.push(policy);
    this.policies.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Remove a policy by name.
   */
  removePolicy(name: string): boolean {
    const index = this.policies.findIndex((p) => p.name === name);
    if (index === -1) return false;
    this.policies.splice(index, 1);
    return true;
  }

  /**
   * Get all registered policies.
   */
  getPolicies(): AccessPolicy[] {
    return [...this.policies];
  }

  // ─── Audit ───────────────────────────────────────────────────

  /**
   * Get the decision audit log.
   */
  getDecisionLog(): AccessDecision[] {
    return [...this.decisionLog];
  }

  /**
   * Get decisions filtered by tenant.
   */
  getDecisionsForTenant(tenantId: string): AccessDecision[] {
    return this.decisionLog.filter((d) => d.context.tenantId === tenantId);
  }

  /**
   * Get denied decisions (for security monitoring).
   */
  getDeniedDecisions(): AccessDecision[] {
    return this.decisionLog.filter((d) => !d.allowed);
  }

  /**
   * Clear the decision log.
   */
  clearDecisionLog(): void {
    this.decisionLog = [];
  }

  // ─── Helpers ─────────────────────────────────────────────────

  /**
   * Get effective permissions for a context (useful for UI).
   */
  getEffectivePermissions(context: TenantContext): string[] {
    const validRoles = context.roles.filter(isValidRole) as RoleName[];
    return [
      ...new Set([
        ...getPermissionsForRoles(validRoles),
        ...context.permissions,
      ]),
    ];
  }

  /**
   * Check if a context has a specific role.
   */
  hasRole(context: TenantContext, role: RoleName): boolean {
    return context.roles.includes(role);
  }

  /**
   * Check if a context has a role at or above a certain level.
   */
  hasRoleAtLevel(context: TenantContext, minLevel: number): boolean {
    const validRoles = context.roles.filter(isValidRole) as RoleName[];
    return validRoles.some((role) => {
      const { ROLE_DEFINITIONS } = require("./roles");
      return ROLE_DEFINITIONS[role]?.level >= minLevel;
    });
  }

  // ─── Private ─────────────────────────────────────────────────

  private createDecision(
    allowed: boolean,
    reason: string,
    permission: string,
    context: TenantContext
  ): AccessDecision {
    const decision: AccessDecision = {
      allowed,
      reason,
      permission,
      context: {
        tenantId: context.tenantId,
        workspaceId: context.workspaceId,
        userId: context.userId,
        roles: context.roles,
      },
      timestamp: new Date().toISOString(),
    };

    // Audit logging
    if (this.options.auditEnabled) {
      this.decisionLog.push(decision);
      this.options.onAccessDecision?.(decision);
    }

    return decision;
  }

  private findMatchingPolicies(permission: string, effect: "allow" | "deny"): AccessPolicy[] {
    const [resource, action] = permission.split(":");
    return this.policies.filter((policy) => {
      if (policy.effect !== effect) return false;
      const resourceMatch = policy.resources.includes(resource) || policy.resources.includes("*");
      const actionMatch = policy.actions.includes(action) || policy.actions.includes("*");
      return resourceMatch && actionMatch;
    });
  }

  private evaluateConditions(conditions: PolicyCondition[] | undefined, context: TenantContext): boolean {
    if (!conditions || conditions.length === 0) return true;
    return conditions.every((condition) => this.evaluateCondition(condition, context));
  }

  private evaluateCondition(condition: PolicyCondition, context: TenantContext): boolean {
    const fieldValue = (context as any)[condition.field];
    switch (condition.operator) {
      case "eq": return fieldValue === condition.value;
      case "neq": return fieldValue !== condition.value;
      case "in": return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      case "not_in": return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
      case "contains": return Array.isArray(fieldValue) && fieldValue.includes(condition.value);
      default: return true;
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────

export class AccessDeniedError extends Error {
  public decision: AccessDecision;

  constructor(decision: AccessDecision) {
    super(`Access denied: ${decision.reason}`);
    this.name = "AccessDeniedError";
    this.decision = decision;
  }
}

// ─────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────

export function createRBACEnforcer(options?: Partial<RBACEnforcerOptions>): RBACEnforcer {
  return new RBACEnforcer(options);
}

/**
 * Create a pre-configured enforcer with D3VONN default policies.
 */
export function createDefaultEnforcer(): RBACEnforcer {
  const enforcer = new RBACEnforcer({ auditEnabled: true, enforceMode: true });

  // Default deny policy: prevent free-tier tenants from deploying agents
  enforcer.addPolicy({
    name: "free-tier-deploy-restriction",
    description: "Free-tier tenants cannot deploy agents to production",
    resources: ["agent"],
    actions: ["deploy"],
    conditions: [{ field: "plan", operator: "eq", value: "free" }],
    effect: "deny",
    priority: 100,
  });

  // Default deny policy: prevent suspended tenants from any write operations
  enforcer.addPolicy({
    name: "suspended-tenant-write-restriction",
    description: "Suspended tenants cannot perform write operations",
    resources: ["*"],
    actions: ["create", "update", "delete", "execute", "deploy"],
    conditions: [{ field: "status", operator: "eq", value: "suspended" }],
    effect: "deny",
    priority: 200,
  });

  return enforcer;
}
