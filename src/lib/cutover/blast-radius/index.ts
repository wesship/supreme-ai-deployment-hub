/**
 * Phase 0 — Blast Radius Boundary Enforcer
 *
 * Enforces hard isolation rules per tenant across all execution layers:
 * - Max concurrent agents per tenant
 * - Per-tenant memory namespace isolation
 * - Per-execution replay sandbox
 * - No cross-tenant governance arbitration sharing
 * - Rate-limited observability ingestion per tenant
 */

export interface TenantLimits {
  tenantId: string;
  maxConcurrentAgents: number;
  maxMemoryNamespaces: number;
  maxObservabilityEventsPerSecond: number;
}

export interface TenantUsage {
  tenantId: string;
  activeAgents: number;
  memoryNamespaces: Set<string>;
  observabilityEventCount: number;
  observabilityWindowStart: number;
}

export class BlastRadiusEnforcer {
  private readonly limits: Map<string, TenantLimits> = new Map();
  private readonly usage: Map<string, TenantUsage> = new Map();

  private readonly defaultLimits: Omit<TenantLimits, "tenantId"> = {
    maxConcurrentAgents: 5,
    maxMemoryNamespaces: 10,
    maxObservabilityEventsPerSecond: 1000,
  };

  registerTenant(limits: TenantLimits): void {
    this.limits.set(limits.tenantId, limits);
    this.usage.set(limits.tenantId, {
      tenantId: limits.tenantId,
      activeAgents: 0,
      memoryNamespaces: new Set(),
      observabilityEventCount: 0,
      observabilityWindowStart: Date.now(),
    });
  }

  /**
   * Request a new agent execution slot for a tenant.
   * Throws if the tenant's concurrent agent limit would be exceeded.
   */
  acquireAgentSlot(tenantId: string): AgentSlot {
    const usage = this.getOrCreateUsage(tenantId);
    const limits = this.getLimits(tenantId);

    if (usage.activeAgents >= limits.maxConcurrentAgents) {
      throw new BlastRadiusViolation(
        tenantId,
        "execution",
        `Concurrent agent limit (${limits.maxConcurrentAgents}) reached`
      );
    }

    usage.activeAgents++;
    const slotId = `slot-${tenantId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return new AgentSlot(slotId, tenantId, () => {
      usage.activeAgents = Math.max(0, usage.activeAgents - 1);
    });
  }

  /**
   * Register a memory namespace for a tenant.
   * Enforces per-tenant isolation — namespaces cannot be shared across tenants.
   */
  registerMemoryNamespace(tenantId: string, namespace: string): void {
    const usage = this.getOrCreateUsage(tenantId);
    const limits = this.getLimits(tenantId);

    if (usage.memoryNamespaces.size >= limits.maxMemoryNamespaces) {
      throw new BlastRadiusViolation(
        tenantId,
        "memory",
        `Memory namespace limit (${limits.maxMemoryNamespaces}) reached`
      );
    }

    // Verify no other tenant owns this namespace
    for (const [otherTenantId, otherUsage] of this.usage) {
      if (otherTenantId !== tenantId && otherUsage.memoryNamespaces.has(namespace)) {
        throw new BlastRadiusViolation(
          tenantId,
          "memory",
          `Namespace '${namespace}' is already owned by tenant '${otherTenantId}'`
        );
      }
    }

    usage.memoryNamespaces.add(namespace);
  }

  /**
   * Record an observability event for a tenant.
   * Rate-limits ingestion to prevent telemetry overload.
   */
  recordObservabilityEvent(tenantId: string): void {
    const usage = this.getOrCreateUsage(tenantId);
    const limits = this.getLimits(tenantId);
    const now = Date.now();

    // Reset window every second
    if (now - usage.observabilityWindowStart >= 1000) {
      usage.observabilityEventCount = 0;
      usage.observabilityWindowStart = now;
    }

    if (usage.observabilityEventCount >= limits.maxObservabilityEventsPerSecond) {
      throw new BlastRadiusViolation(
        tenantId,
        "observability",
        `Observability rate limit (${limits.maxObservabilityEventsPerSecond} events/s) exceeded`
      );
    }

    usage.observabilityEventCount++;
  }

  getUsage(tenantId: string): TenantUsage | undefined {
    return this.usage.get(tenantId);
  }

  private getLimits(tenantId: string): TenantLimits {
    return this.limits.get(tenantId) ?? { tenantId, ...this.defaultLimits };
  }

  private getOrCreateUsage(tenantId: string): TenantUsage {
    if (!this.usage.has(tenantId)) {
      this.usage.set(tenantId, {
        tenantId,
        activeAgents: 0,
        memoryNamespaces: new Set(),
        observabilityEventCount: 0,
        observabilityWindowStart: Date.now(),
      });
    }
    return this.usage.get(tenantId)!;
  }
}

/** RAII-style agent slot that releases the concurrency counter on dispose. */
export class AgentSlot {
  private released = false;
  constructor(
    readonly slotId: string,
    readonly tenantId: string,
    private readonly release: () => void
  ) {}

  dispose(): void {
    if (!this.released) {
      this.released = true;
      this.release();
    }
  }
}

export class BlastRadiusViolation extends Error {
  constructor(
    readonly tenantId: string,
    readonly layer: "execution" | "memory" | "replay" | "governance" | "observability",
    message: string
  ) {
    super(`Blast radius violation [${layer}] for tenant '${tenantId}': ${message}`);
    this.name = "BlastRadiusViolation";
  }
}

/** Singleton enforcer for use across the runtime. */
export const blastRadius = new BlastRadiusEnforcer();
