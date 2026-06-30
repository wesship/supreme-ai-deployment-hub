/**
 * D3VONN Multi-Tenant Foundations — Type Definitions
 *
 * Defines the tenant hierarchy:
 *   Platform → Tenant → Workspace → User → Resources
 *
 * All entities in the system are scoped to a tenant and workspace.
 * This ensures complete data isolation at the application level.
 *
 * @module shared/tenancy/types
 * @version 1.0.0
 */

// ─────────────────────────────────────────────────────────────────
// Branded Types
// ─────────────────────────────────────────────────────────────────

export type TenantId = string & { readonly __brand: "TenantId" };
export type WorkspaceId = string & { readonly __brand: "WorkspaceId" };
export type UserId = string & { readonly __brand: "UserId" };
export type RoleId = string & { readonly __brand: "RoleId" };

// ─────────────────────────────────────────────────────────────────
// Tenant Hierarchy
// ─────────────────────────────────────────────────────────────────

/**
 * Platform-level entity. The root of the hierarchy.
 * Only one platform exists (the D3VONN system itself).
 */
export interface Platform {
  id: "d3vonn";
  name: "D3VONN AI Operating System";
  version: string;
  tenants: TenantId[];
}

/**
 * A tenant represents an organization or company.
 * All resources are isolated at the tenant boundary.
 */
export interface Tenant {
  id: TenantId;
  name: string;
  slug: string;
  plan: TenantPlan;
  settings: TenantSettings;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * A workspace represents a department, team, or project within a tenant.
 * Workspaces provide sub-isolation within a tenant.
 */
export interface Workspace {
  id: WorkspaceId;
  tenantId: TenantId;
  name: string;
  slug: string;
  settings: WorkspaceSettings;
  status: "active" | "archived" | "suspended";
  createdAt: string;
  updatedAt: string;
}

/**
 * A user belongs to a tenant and can access one or more workspaces.
 */
export interface User {
  id: UserId;
  tenantId: TenantId;
  workspaceIds: WorkspaceId[];
  email: string;
  name: string;
  status: "active" | "inactive" | "suspended";
  createdAt: string;
  lastLoginAt?: string;
}

// ─────────────────────────────────────────────────────────────────
// Tenant Configuration
// ─────────────────────────────────────────────────────────────────

export type TenantPlan = "free" | "starter" | "professional" | "enterprise" | "custom";

export type TenantStatus = "active" | "trial" | "suspended" | "deactivated";

export interface TenantSettings {
  /** Maximum number of workspaces allowed */
  maxWorkspaces: number;
  /** Maximum number of users allowed */
  maxUsers: number;
  /** Maximum number of agents allowed */
  maxAgents: number;
  /** Maximum events per month */
  maxEventsPerMonth: number;
  /** Maximum memory storage in bytes */
  maxMemoryBytes: number;
  /** Allowed agent capabilities */
  allowedCapabilities: string[];
  /** Custom domain (enterprise only) */
  customDomain?: string;
  /** Data residency region */
  dataRegion: DataRegion;
  /** Whether RLS is enforced */
  rlsEnabled: boolean;
  /** Whether audit logging is enabled */
  auditEnabled: boolean;
  /** Retention period for events in days */
  eventRetentionDays: number;
  /** Retention period for audit logs in days */
  auditRetentionDays: number;
}

export interface WorkspaceSettings {
  /** Default agent model for this workspace */
  defaultModel: string;
  /** Whether workspace members can create agents */
  allowAgentCreation: boolean;
  /** Maximum concurrent tasks */
  maxConcurrentTasks: number;
  /** Notification preferences */
  notifications: {
    email: boolean;
    webhook: boolean;
    slack: boolean;
  };
}

export type DataRegion = "us-east-1" | "us-west-2" | "eu-west-1" | "ap-southeast-1" | "global";

// ─────────────────────────────────────────────────────────────────
// Tenant Context (Runtime)
// ─────────────────────────────────────────────────────────────────

/**
 * The tenant context is resolved at the API boundary and threaded
 * through all operations. Every service call, event publish, and
 * database query uses this context for isolation.
 */
export interface TenantContext {
  tenantId: TenantId;
  workspaceId: WorkspaceId;
  userId: UserId;
  roles: string[];
  permissions: string[];
  plan: TenantPlan;
  dataRegion: DataRegion;
}

/**
 * Minimal context for system-level operations that don't belong
 * to a specific user (e.g., scheduled jobs, system events).
 */
export interface SystemContext {
  tenantId: TenantId;
  workspaceId: WorkspaceId;
  userId: "system" | UserId;
  roles: ["system"];
  permissions: ["*"];
  plan: TenantPlan;
  dataRegion: DataRegion;
}

// ─────────────────────────────────────────────────────────────────
// Tenant Resolution
// ─────────────────────────────────────────────────────────────────

export type TenantResolutionStrategy =
  | "header"      // X-Tenant-ID header
  | "subdomain"   // tenant.d3vonn.io
  | "path"        // /api/v1/tenants/:tenantId/...
  | "jwt"         // Extracted from JWT claims
  | "api-key";    // Mapped from API key

export interface TenantResolutionConfig {
  strategy: TenantResolutionStrategy;
  headerName: string;
  fallbackStrategy?: TenantResolutionStrategy;
  cacheTtlMs: number;
}

// ─────────────────────────────────────────────────────────────────
// Environment Configuration
// ─────────────────────────────────────────────────────────────────

export interface MultiTenantConfig {
  enabled: boolean;
  resolution: TenantResolutionStrategy;
  headerName: string;
  rlsEnabled: boolean;
  defaultPlan: TenantPlan;
  defaultRegion: DataRegion;
}

export const DEFAULT_MULTI_TENANT_CONFIG: MultiTenantConfig = {
  enabled: true,
  resolution: "header",
  headerName: "X-Tenant-ID",
  rlsEnabled: true,
  defaultPlan: "free",
  defaultRegion: "us-east-1",
};

// ─────────────────────────────────────────────────────────────────
// Factory Helpers
// ─────────────────────────────────────────────────────────────────

export function createTenantId(id: string): TenantId {
  return id as TenantId;
}

export function createWorkspaceId(id: string): WorkspaceId {
  return id as WorkspaceId;
}

export function createUserId(id: string): UserId {
  return id as UserId;
}

export function createTenantContext(params: {
  tenantId: string;
  workspaceId: string;
  userId: string;
  roles: string[];
  permissions: string[];
  plan?: TenantPlan;
  dataRegion?: DataRegion;
}): TenantContext {
  return {
    tenantId: createTenantId(params.tenantId),
    workspaceId: createWorkspaceId(params.workspaceId),
    userId: createUserId(params.userId),
    roles: params.roles,
    permissions: params.permissions,
    plan: params.plan ?? "free",
    dataRegion: params.dataRegion ?? "us-east-1",
  };
}

export function createSystemContext(tenantId: string, workspaceId: string): SystemContext {
  return {
    tenantId: createTenantId(tenantId),
    workspaceId: createWorkspaceId(workspaceId),
    userId: "system",
    roles: ["system"],
    permissions: ["*"],
    plan: "enterprise",
    dataRegion: "global",
  };
}
