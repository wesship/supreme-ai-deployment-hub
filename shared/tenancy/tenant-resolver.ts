/**
 * D3VONN Multi-Tenant Foundations — Tenant Resolver
 *
 * Resolves tenant identity from incoming requests using configurable
 * strategies: header, subdomain, path, JWT, or API key.
 *
 * @module shared/tenancy/tenant-resolver
 * @version 1.0.0
 */

import {
  TenantContext,
  TenantResolutionStrategy,
  TenantResolutionConfig,
  TenantId,
  WorkspaceId,
  UserId,
  TenantPlan,
  DataRegion,
  Tenant,
  createTenantId,
  createWorkspaceId,
  createUserId,
  DEFAULT_MULTI_TENANT_CONFIG,
} from "./types";
import {
  TenantResolver,
  RequestLike,
  TenantNotFoundError,
  TenantSuspendedError,
} from "./tenant-context";

// ─────────────────────────────────────────────────────────────────
// Tenant Service Interface
// ─────────────────────────────────────────────────────────────────

/**
 * Interface for tenant data access.
 * Implement this with your database layer.
 */
export interface TenantService {
  /** Find a tenant by ID */
  findById(tenantId: string): Promise<Tenant | null>;
  /** Find a tenant by slug (for subdomain resolution) */
  findBySlug(slug: string): Promise<Tenant | null>;
  /** Find a tenant by API key */
  findByApiKey(apiKey: string): Promise<{ tenant: Tenant; userId: string; roles: string[] } | null>;
  /** Get user roles and permissions for a tenant */
  getUserContext(userId: string, tenantId: string, workspaceId: string): Promise<{
    roles: string[];
    permissions: string[];
    plan: TenantPlan;
    dataRegion: DataRegion;
  } | null>;
}

// ─────────────────────────────────────────────────────────────────
// Multi-Strategy Resolver
// ─────────────────────────────────────────────────────────────────

/**
 * Resolves tenant context from requests using the configured strategy.
 * Supports fallback strategies and caching.
 */
export class MultiStrategyTenantResolver implements TenantResolver {
  private config: TenantResolutionConfig;
  private tenantService: TenantService;
  private cache: Map<string, { context: TenantContext; expiresAt: number }> = new Map();

  constructor(tenantService: TenantService, config?: Partial<TenantResolutionConfig>) {
    this.tenantService = tenantService;
    this.config = {
      strategy: config?.strategy ?? DEFAULT_MULTI_TENANT_CONFIG.resolution,
      headerName: config?.headerName ?? DEFAULT_MULTI_TENANT_CONFIG.headerName,
      fallbackStrategy: config?.fallbackStrategy,
      cacheTtlMs: config?.cacheTtlMs ?? 60000, // 1 minute default
    };
  }

  async resolve(req: RequestLike): Promise<TenantContext | null> {
    // Try primary strategy
    let result = await this.resolveWithStrategy(req, this.config.strategy);

    // Try fallback if primary fails
    if (!result && this.config.fallbackStrategy) {
      result = await this.resolveWithStrategy(req, this.config.fallbackStrategy);
    }

    return result;
  }

  private async resolveWithStrategy(
    req: RequestLike,
    strategy: TenantResolutionStrategy
  ): Promise<TenantContext | null> {
    switch (strategy) {
      case "header":
        return this.resolveFromHeader(req);
      case "subdomain":
        return this.resolveFromSubdomain(req);
      case "path":
        return this.resolveFromPath(req);
      case "jwt":
        return this.resolveFromJwt(req);
      case "api-key":
        return this.resolveFromApiKey(req);
      default:
        return null;
    }
  }

  // ─── Header Strategy ─────────────────────────────────────────

  private async resolveFromHeader(req: RequestLike): Promise<TenantContext | null> {
    const headerName = this.config.headerName.toLowerCase();
    const tenantId = this.getHeader(req, headerName);
    if (!tenantId) return null;

    const workspaceId = this.getHeader(req, "x-workspace-id") ?? "default";
    const userId = this.getHeader(req, "x-user-id") ?? "anonymous";

    return this.buildContext(tenantId, workspaceId, userId);
  }

  // ─── Subdomain Strategy ──────────────────────────────────────

  private async resolveFromSubdomain(req: RequestLike): Promise<TenantContext | null> {
    const hostname = req.hostname;
    if (!hostname) return null;

    // Extract subdomain: tenant.d3vonn.io → tenant
    const parts = hostname.split(".");
    if (parts.length < 3) return null;
    const slug = parts[0];

    const tenant = await this.tenantService.findBySlug(slug);
    if (!tenant) return null;

    const workspaceId = this.getHeader(req, "x-workspace-id") ?? "default";
    const userId = this.getHeader(req, "x-user-id") ?? "anonymous";

    return this.buildContext(tenant.id, workspaceId, userId);
  }

  // ─── Path Strategy ───────────────────────────────────────────

  private async resolveFromPath(req: RequestLike): Promise<TenantContext | null> {
    const tenantId = req.params?.tenantId;
    if (!tenantId) return null;

    const workspaceId = req.params?.workspaceId ?? "default";
    const userId = this.getHeader(req, "x-user-id") ?? "anonymous";

    return this.buildContext(tenantId, workspaceId, userId);
  }

  // ─── JWT Strategy ────────────────────────────────────────────

  private async resolveFromJwt(req: RequestLike): Promise<TenantContext | null> {
    const authHeader = this.getHeader(req, "authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;

    const token = authHeader.slice(7);
    // Decode JWT payload (without verification — verification happens upstream)
    try {
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1], "base64url").toString()
      );

      const tenantId = payload.tenant_id || payload.tenantId;
      const workspaceId = payload.workspace_id || payload.workspaceId || "default";
      const userId = payload.sub || payload.user_id || "anonymous";

      if (!tenantId) return null;
      return this.buildContext(tenantId, workspaceId, userId);
    } catch {
      return null;
    }
  }

  // ─── API Key Strategy ────────────────────────────────────────

  private async resolveFromApiKey(req: RequestLike): Promise<TenantContext | null> {
    const apiKey =
      this.getHeader(req, "x-api-key") ||
      this.getHeader(req, "authorization")?.replace("Bearer ", "");

    if (!apiKey || !apiKey.startsWith("d3v_")) return null;

    const result = await this.tenantService.findByApiKey(apiKey);
    if (!result) return null;

    const workspaceId = this.getHeader(req, "x-workspace-id") ?? "default";

    return {
      tenantId: result.tenant.id,
      workspaceId: createWorkspaceId(workspaceId),
      userId: createUserId(result.userId),
      roles: result.roles,
      permissions: [], // Will be resolved from roles
      plan: result.tenant.plan,
      dataRegion: result.tenant.settings.dataRegion,
    };
  }

  // ─── Context Builder ─────────────────────────────────────────

  private async buildContext(
    tenantId: string,
    workspaceId: string,
    userId: string
  ): Promise<TenantContext | null> {
    // Check cache
    const cacheKey = `${tenantId}:${workspaceId}:${userId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.context;
    }

    // Verify tenant exists and is active
    const tenant = await this.tenantService.findById(tenantId);
    if (!tenant) throw new TenantNotFoundError(tenantId);
    if (tenant.status === "suspended") throw new TenantSuspendedError(tenantId);
    if (tenant.status === "deactivated") throw new TenantNotFoundError(tenantId);

    // Get user context
    const userContext = await this.tenantService.getUserContext(userId, tenantId, workspaceId);

    const context: TenantContext = {
      tenantId: createTenantId(tenantId),
      workspaceId: createWorkspaceId(workspaceId),
      userId: createUserId(userId),
      roles: userContext?.roles ?? ["viewer"],
      permissions: userContext?.permissions ?? ["read"],
      plan: userContext?.plan ?? tenant.plan,
      dataRegion: userContext?.dataRegion ?? tenant.settings.dataRegion,
    };

    // Cache the context
    this.cache.set(cacheKey, {
      context,
      expiresAt: Date.now() + this.config.cacheTtlMs,
    });

    return context;
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private getHeader(req: RequestLike, name: string): string | undefined {
    const value = req.headers[name] ?? req.headers[name.toLowerCase()];
    if (Array.isArray(value)) return value[0];
    return value;
  }

  /** Clear the resolution cache */
  clearCache(): void {
    this.cache.clear();
  }

  /** Get cache stats */
  getCacheStats(): { size: number; hitRate: number } {
    return { size: this.cache.size, hitRate: 0 }; // hitRate would need tracking
  }
}

// ─────────────────────────────────────────────────────────────────
// In-Memory Tenant Service (for testing)
// ─────────────────────────────────────────────────────────────────

export class InMemoryTenantService implements TenantService {
  private tenants: Map<string, Tenant> = new Map();
  private slugIndex: Map<string, string> = new Map();
  private apiKeyIndex: Map<string, { tenantId: string; userId: string; roles: string[] }> = new Map();
  private userContexts: Map<string, { roles: string[]; permissions: string[]; plan: TenantPlan; dataRegion: DataRegion }> = new Map();

  addTenant(tenant: Tenant): void {
    this.tenants.set(tenant.id, tenant);
    this.slugIndex.set(tenant.slug, tenant.id);
  }

  addApiKey(apiKey: string, tenantId: string, userId: string, roles: string[]): void {
    this.apiKeyIndex.set(apiKey, { tenantId, userId, roles });
  }

  addUserContext(userId: string, tenantId: string, workspaceId: string, context: {
    roles: string[];
    permissions: string[];
    plan: TenantPlan;
    dataRegion: DataRegion;
  }): void {
    this.userContexts.set(`${userId}:${tenantId}:${workspaceId}`, context);
  }

  async findById(tenantId: string): Promise<Tenant | null> {
    return this.tenants.get(tenantId) ?? null;
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    const id = this.slugIndex.get(slug);
    if (!id) return null;
    return this.tenants.get(id) ?? null;
  }

  async findByApiKey(apiKey: string): Promise<{ tenant: Tenant; userId: string; roles: string[] } | null> {
    const entry = this.apiKeyIndex.get(apiKey);
    if (!entry) return null;
    const tenant = this.tenants.get(entry.tenantId);
    if (!tenant) return null;
    return { tenant, userId: entry.userId, roles: entry.roles };
  }

  async getUserContext(userId: string, tenantId: string, workspaceId: string): Promise<{
    roles: string[];
    permissions: string[];
    plan: TenantPlan;
    dataRegion: DataRegion;
  } | null> {
    return this.userContexts.get(`${userId}:${tenantId}:${workspaceId}`) ?? null;
  }
}

// ─────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────

export function createTenantResolver(
  tenantService: TenantService,
  config?: Partial<TenantResolutionConfig>
): MultiStrategyTenantResolver {
  return new MultiStrategyTenantResolver(tenantService, config);
}
