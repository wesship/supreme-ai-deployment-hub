/**
 * D3VONN Multi-Tenant Foundations — RBAC Roles
 *
 * Defines the 5-tier role hierarchy:
 *   Super Admin → Tenant Admin → Workspace Admin → Agent Operator → Data Analyst
 *
 * Roles are scoped per tenant and workspace. A user can have different
 * roles in different workspaces within the same tenant.
 *
 * @module shared/rbac/roles
 * @version 1.0.0
 */

// ─────────────────────────────────────────────────────────────────
// Role Definitions
// ─────────────────────────────────────────────────────────────────

export type RoleName =
  | "super_admin"
  | "tenant_admin"
  | "workspace_admin"
  | "agent_operator"
  | "data_analyst";

export interface RoleDefinition {
  name: RoleName;
  displayName: string;
  description: string;
  level: number; // Higher = more privileged
  scope: "platform" | "tenant" | "workspace";
  inherits?: RoleName[];
  permissions: string[];
}

/**
 * Complete role hierarchy for the D3VONN platform.
 * Roles inherit permissions from lower-level roles.
 */
export const ROLE_DEFINITIONS: Record<RoleName, RoleDefinition> = {
  super_admin: {
    name: "super_admin",
    displayName: "Super Admin",
    description: "Platform-wide access. Can manage all tenants, users, and system configuration.",
    level: 100,
    scope: "platform",
    inherits: ["tenant_admin"],
    permissions: [
      "platform:manage",
      "tenant:create",
      "tenant:delete",
      "tenant:suspend",
      "system:configure",
      "system:audit",
      "billing:manage",
    ],
  },
  tenant_admin: {
    name: "tenant_admin",
    displayName: "Tenant Admin",
    description: "Full tenant management. Can manage workspaces, users, and tenant settings.",
    level: 80,
    scope: "tenant",
    inherits: ["workspace_admin"],
    permissions: [
      "tenant:read",
      "tenant:update",
      "tenant:settings",
      "workspace:create",
      "workspace:delete",
      "user:invite",
      "user:remove",
      "user:roles",
      "api-key:manage",
      "billing:read",
      "audit:read",
      "agent:deploy",
      "agent:delete",
    ],
  },
  workspace_admin: {
    name: "workspace_admin",
    displayName: "Workspace Admin",
    description: "Workspace management. Can manage agents, workflows, and workspace members.",
    level: 60,
    scope: "workspace",
    inherits: ["agent_operator"],
    permissions: [
      "workspace:read",
      "workspace:update",
      "workspace:settings",
      "workspace:members",
      "agent:create",
      "agent:update",
      "agent:configure",
      "workflow:create",
      "workflow:update",
      "workflow:delete",
      "integration:manage",
      "knowledge:manage",
    ],
  },
  agent_operator: {
    name: "agent_operator",
    displayName: "Agent Operator",
    description: "Agent execution. Can run agents, create tasks, and view results.",
    level: 40,
    scope: "workspace",
    inherits: ["data_analyst"],
    permissions: [
      "agent:execute",
      "agent:read",
      "task:create",
      "task:cancel",
      "task:read",
      "workflow:execute",
      "workflow:read",
      "tool:use",
      "memory:read",
      "memory:write",
      "event:publish",
      "event:subscribe",
    ],
  },
  data_analyst: {
    name: "data_analyst",
    displayName: "Data Analyst",
    description: "Read-only access to data, reports, and analytics.",
    level: 20,
    scope: "workspace",
    permissions: [
      "data:read",
      "report:read",
      "report:create",
      "dashboard:read",
      "event:read",
      "knowledge:read",
      "agent:status",
      "task:status",
      "audit:read",
    ],
  },
};

// ─────────────────────────────────────────────────────────────────
// Role Utilities
// ─────────────────────────────────────────────────────────────────

/**
 * Get all permissions for a role, including inherited permissions.
 */
export function getEffectivePermissions(roleName: RoleName): string[] {
  const role = ROLE_DEFINITIONS[roleName];
  if (!role) return [];

  const permissions = new Set<string>(role.permissions);

  // Recursively add inherited permissions
  if (role.inherits) {
    for (const inheritedRole of role.inherits) {
      const inherited = getEffectivePermissions(inheritedRole);
      for (const perm of inherited) {
        permissions.add(perm);
      }
    }
  }

  return [...permissions];
}

/**
 * Get all permissions for a set of roles.
 */
export function getPermissionsForRoles(roles: RoleName[]): string[] {
  const permissions = new Set<string>();
  for (const role of roles) {
    for (const perm of getEffectivePermissions(role)) {
      permissions.add(perm);
    }
  }
  return [...permissions];
}

/**
 * Check if a role is at or above a certain level.
 */
export function isRoleAtLevel(roleName: RoleName, minLevel: number): boolean {
  const role = ROLE_DEFINITIONS[roleName];
  return role ? role.level >= minLevel : false;
}

/**
 * Get the highest-level role from a set of roles.
 */
export function getHighestRole(roles: RoleName[]): RoleName | null {
  if (roles.length === 0) return null;
  return roles.reduce((highest, current) => {
    const currentLevel = ROLE_DEFINITIONS[current]?.level ?? 0;
    const highestLevel = ROLE_DEFINITIONS[highest]?.level ?? 0;
    return currentLevel > highestLevel ? current : highest;
  });
}

/**
 * Check if a role name is valid.
 */
export function isValidRole(name: string): name is RoleName {
  return name in ROLE_DEFINITIONS;
}

/**
 * Get all role names.
 */
export function getAllRoles(): RoleName[] {
  return Object.keys(ROLE_DEFINITIONS) as RoleName[];
}

/**
 * Get roles at or above a specific scope.
 */
export function getRolesForScope(scope: "platform" | "tenant" | "workspace"): RoleName[] {
  const scopeLevel = { platform: 3, tenant: 2, workspace: 1 };
  const minLevel = scopeLevel[scope];
  return getAllRoles().filter((role) => {
    const roleScope = ROLE_DEFINITIONS[role].scope;
    return scopeLevel[roleScope] >= minLevel;
  });
}
