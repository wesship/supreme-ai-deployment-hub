/**
 * D3VONN Multi-Tenant Foundations — Tenant Context
 *
 * Provides request-scoped tenant context propagation using
 * AsyncLocalStorage (Node.js) pattern. Ensures every operation
 * within a request has access to the tenant context without
 * explicit parameter passing.
 *
 * @module shared/tenancy/tenant-context
 * @version 1.0.0
 */

import {
  TenantContext,
  SystemContext,
  TenantId,
  WorkspaceId,
  UserId,
  createTenantContext,
  createSystemContext,
} from "./types";

// ─────────────────────────────────────────────────────────────────
// Context Store (AsyncLocalStorage pattern)
// ─────────────────────────────────────────────────────────────────

type ContextStore = Map<string, TenantContext | SystemContext>;

/**
 * Global context store for tenant context propagation.
 * In production, this would use AsyncLocalStorage.
 * This implementation provides a synchronous fallback.
 */
class TenantContextStore {
  private store: ContextStore = new Map();
  private currentRequestId: string | null = null;

  /** Set the context for the current request */
  set(requestId: string, context: TenantContext | SystemContext): void {
    this.store.set(requestId, context);
    this.currentRequestId = requestId;
  }

  /** Get the context for the current request */
  get(requestId?: string): TenantContext | SystemContext | null {
    const id = requestId ?? this.currentRequestId;
    if (!id) return null;
    return this.store.get(id) ?? null;
  }

  /** Remove the context for a completed request */
  clear(requestId: string): void {
    this.store.delete(requestId);
    if (this.currentRequestId === requestId) {
      this.currentRequestId = null;
    }
  }

  /** Get the current tenant ID */
  getCurrentTenantId(): TenantId | null {
    const ctx = this.get();
    return ctx?.tenantId ?? null;
  }

  /** Get the current workspace ID */
  getCurrentWorkspaceId(): WorkspaceId | null {
    const ctx = this.get();
    return ctx?.workspaceId ?? null;
  }

  /** Get the current user ID */
  getCurrentUserId(): UserId | "system" | null {
    const ctx = this.get();
    return ctx?.userId ?? null;
  }

  /** Check if the current context is a system context */
  isSystemContext(): boolean {
    const ctx = this.get();
    return ctx?.userId === "system";
  }

  /** Get active context count (for monitoring) */
  getActiveCount(): number {
    return this.store.size;
  }

  /** Reset all contexts (for testing) */
  reset(): void {
    this.store.clear();
    this.currentRequestId = null;
  }
}

// Singleton instance
export const tenantContextStore = new TenantContextStore();

// ─────────────────────────────────────────────────────────────────
// Context Middleware
// ─────────────────────────────────────────────────────────────────

export interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  params?: Record<string, string>;
  path?: string;
  hostname?: string;
}

export interface ResponseLike {
  status: (code: number) => ResponseLike;
  json: (body: unknown) => void;
}

export interface NextFunction {
  (): void;
}

/**
 * Express-compatible middleware that resolves tenant context
 * from the request and stores it for the duration of the request.
 */
export function tenantContextMiddleware(
  resolver: TenantResolver
) {
  return async (req: RequestLike, res: ResponseLike, next: NextFunction): Promise<void> => {
    const requestId = generateRequestId();

    try {
      const context = await resolver.resolve(req);
      if (!context) {
        res.status(400).json({ error: "Tenant ID required", code: "TENANT_REQUIRED" });
        return;
      }

      tenantContextStore.set(requestId, context);

      // Attach to request for direct access
      (req as any).tenantContext = context;
      (req as any).requestId = requestId;

      next();
    } catch (error) {
      res.status(401).json({
        error: "Tenant resolution failed",
        code: "TENANT_RESOLUTION_FAILED",
      });
    }
  };
}

/**
 * Cleanup middleware to remove context after response is sent.
 */
export function tenantContextCleanup() {
  return (req: RequestLike, _res: ResponseLike, next: NextFunction): void => {
    const requestId = (req as any).requestId;
    if (requestId) {
      // Use setImmediate to clean up after response
      setTimeout(() => tenantContextStore.clear(requestId), 0);
    }
    next();
  };
}

// ─────────────────────────────────────────────────────────────────
// Tenant Resolver Interface
// ─────────────────────────────────────────────────────────────────

export interface TenantResolver {
  /** Resolve tenant context from a request */
  resolve(req: RequestLike): Promise<TenantContext | null>;
}

// ─────────────────────────────────────────────────────────────────
// Context Utilities
// ─────────────────────────────────────────────────────────────────

/**
 * Run a function within a specific tenant context.
 * Useful for background jobs and scheduled tasks.
 */
export async function withTenantContext<T>(
  context: TenantContext | SystemContext,
  fn: () => Promise<T>
): Promise<T> {
  const requestId = generateRequestId();
  tenantContextStore.set(requestId, context);
  try {
    return await fn();
  } finally {
    tenantContextStore.clear(requestId);
  }
}

/**
 * Run a function as the system user within a tenant.
 * Used for automated operations (cron jobs, event handlers).
 */
export async function withSystemContext<T>(
  tenantId: string,
  workspaceId: string,
  fn: () => Promise<T>
): Promise<T> {
  const context = createSystemContext(tenantId, workspaceId);
  return withTenantContext(context, fn);
}

/**
 * Assert that a tenant context is available.
 * Throws if called outside a tenant-scoped operation.
 */
export function requireTenantContext(): TenantContext | SystemContext {
  const ctx = tenantContextStore.get();
  if (!ctx) {
    throw new Error(
      "Tenant context required but not available. " +
      "Ensure this code runs within a tenant-scoped request or withTenantContext()."
    );
  }
  return ctx;
}

/**
 * Assert that the current context has a specific permission.
 */
export function requirePermission(permission: string): void {
  const ctx = requireTenantContext();
  if (ctx.permissions.includes("*")) return; // System context
  if (!ctx.permissions.includes(permission)) {
    throw new TenantPermissionError(
      `Missing required permission: ${permission}`,
      permission,
      ctx.tenantId
    );
  }
}

// ─────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────

export class TenantNotFoundError extends Error {
  constructor(public tenantId: string) {
    super(`Tenant not found: ${tenantId}`);
    this.name = "TenantNotFoundError";
  }
}

export class TenantSuspendedError extends Error {
  constructor(public tenantId: string) {
    super(`Tenant is suspended: ${tenantId}`);
    this.name = "TenantSuspendedError";
  }
}

export class TenantPermissionError extends Error {
  constructor(
    message: string,
    public permission: string,
    public tenantId: string
  ) {
    super(message);
    this.name = "TenantPermissionError";
  }
}

export class WorkspaceNotFoundError extends Error {
  constructor(public workspaceId: string, public tenantId: string) {
    super(`Workspace ${workspaceId} not found in tenant ${tenantId}`);
    this.name = "WorkspaceNotFoundError";
  }
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}
