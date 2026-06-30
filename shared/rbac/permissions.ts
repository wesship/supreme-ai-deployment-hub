/**
 * D3VONN Multi-Tenant Foundations — RBAC Permissions
 *
 * Permission system using resource:action format.
 * Supports wildcards, resource-specific scoping, and
 * conditional permissions based on ownership.
 *
 * @module shared/rbac/permissions
 * @version 1.0.0
 */

// ─────────────────────────────────────────────────────────────────
// Permission Types
// ─────────────────────────────────────────────────────────────────

export type Resource =
  | "platform"
  | "tenant"
  | "workspace"
  | "user"
  | "agent"
  | "task"
  | "workflow"
  | "event"
  | "memory"
  | "knowledge"
  | "tool"
  | "integration"
  | "data"
  | "report"
  | "dashboard"
  | "audit"
  | "billing"
  | "api-key"
  | "system";

export type Action =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "execute"
  | "manage"
  | "configure"
  | "deploy"
  | "suspend"
  | "invite"
  | "remove"
  | "roles"
  | "settings"
  | "members"
  | "publish"
  | "subscribe"
  | "use"
  | "write"
  | "status"
  | "cancel";

export type Permission = `${Resource}:${Action}` | "*";

export interface PermissionCheck {
  permission: Permission;
  resource?: string;      // Specific resource ID
  ownerId?: string;       // For ownership-based checks
  conditions?: Record<string, unknown>;
}

export interface PermissionGrant {
  permission: Permission;
  scope: "platform" | "tenant" | "workspace";
  conditions?: PermissionCondition[];
}

export interface PermissionCondition {
  type: "ownership" | "time" | "ip" | "mfa" | "plan";
  value: unknown;
}

// ─────────────────────────────────────────────────────────────────
// Permission Registry
// ─────────────────────────────────────────────────────────────────

/**
 * All available permissions in the system, organized by resource.
 */
export const PERMISSION_CATALOG: Record<Resource, Action[]> = {
  platform: ["manage", "configure", "read"],
  tenant: ["create", "read", "update", "delete", "suspend", "settings"],
  workspace: ["create", "read", "update", "delete", "settings", "members"],
  user: ["create", "read", "update", "delete", "invite", "remove", "roles"],
  agent: ["create", "read", "update", "delete", "execute", "configure", "deploy", "status"],
  task: ["create", "read", "update", "delete", "cancel", "status"],
  workflow: ["create", "read", "update", "delete", "execute"],
  event: ["read", "publish", "subscribe"],
  memory: ["read", "write", "delete", "manage"],
  knowledge: ["read", "write", "manage"],
  tool: ["read", "use", "manage"],
  integration: ["read", "manage", "configure"],
  data: ["read", "write", "delete", "manage"],
  report: ["read", "create", "delete"],
  dashboard: ["read", "create", "update", "delete"],
  audit: ["read"],
  billing: ["read", "manage"],
  "api-key": ["create", "read", "delete", "manage"],
  system: ["configure", "manage", "read"],
};

// ─────────────────────────────────────────────────────────────────
// Permission Utilities
// ─────────────────────────────────────────────────────────────────

/**
 * Parse a permission string into resource and action.
 */
export function parsePermission(permission: string): { resource: Resource; action: Action } | null {
  if (permission === "*") return null;
  const [resource, action] = permission.split(":") as [Resource, Action];
  if (!resource || !action) return null;
  if (!(resource in PERMISSION_CATALOG)) return null;
  return { resource, action };
}

/**
 * Check if a permission string is valid.
 */
export function isValidPermission(permission: string): boolean {
  if (permission === "*") return true;
  const parsed = parsePermission(permission);
  if (!parsed) return false;
  return PERMISSION_CATALOG[parsed.resource]?.includes(parsed.action) ?? false;
}

/**
 * Check if a set of granted permissions satisfies a required permission.
 * Supports wildcard matching.
 */
export function hasPermission(
  grantedPermissions: string[],
  requiredPermission: string
): boolean {
  // Wildcard grants everything
  if (grantedPermissions.includes("*")) return true;

  // Direct match
  if (grantedPermissions.includes(requiredPermission)) return true;

  // Resource wildcard: "agent:*" matches "agent:read"
  const parsed = parsePermission(requiredPermission);
  if (parsed) {
    if (grantedPermissions.includes(`${parsed.resource}:*`)) return true;
    // "manage" implies all actions on that resource
    if (grantedPermissions.includes(`${parsed.resource}:manage`)) return true;
  }

  return false;
}

/**
 * Check if a set of granted permissions satisfies ALL required permissions.
 */
export function hasAllPermissions(
  grantedPermissions: string[],
  requiredPermissions: string[]
): boolean {
  return requiredPermissions.every((perm) => hasPermission(grantedPermissions, perm));
}

/**
 * Check if a set of granted permissions satisfies ANY of the required permissions.
 */
export function hasAnyPermission(
  grantedPermissions: string[],
  requiredPermissions: string[]
): boolean {
  return requiredPermissions.some((perm) => hasPermission(grantedPermissions, perm));
}

/**
 * Get all valid permissions as a flat list.
 */
export function getAllPermissions(): Permission[] {
  const permissions: Permission[] = ["*"];
  for (const [resource, actions] of Object.entries(PERMISSION_CATALOG)) {
    for (const action of actions) {
      permissions.push(`${resource}:${action}` as Permission);
    }
  }
  return permissions;
}

/**
 * Get permissions for a specific resource.
 */
export function getResourcePermissions(resource: Resource): Permission[] {
  const actions = PERMISSION_CATALOG[resource];
  if (!actions) return [];
  return actions.map((action) => `${resource}:${action}` as Permission);
}
