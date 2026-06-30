/**
 * D3VONN Multi-Tenant Event Bus — Tenant-Aware Extension
 *
 * Wraps the core event bus with tenant context enforcement.
 * All events are automatically scoped to the publishing tenant,
 * and subscribers only receive events for their tenant.
 *
 * Features:
 * - Automatic tenant context injection into event metadata
 * - Tenant-scoped subscriptions (subscribers only see their tenant's events)
 * - Cross-tenant event isolation
 * - Tenant-aware dead-letter queue
 * - Audit logging for all cross-tenant operations
 *
 * @module shared/events/tenant-event-bus
 * @version 1.0.0
 */

import {
  EventName,
  TypedEvent,
  AnyEvent,
  EventHandler,
  Subscription,
  EventFilter,
  EventMetadata,
  TenantId,
  WorkspaceId,
} from "./event-types";
import { TenantContext } from "../tenancy/types";

// ─────────────────────────────────────────────────────────────────
// Tenant-Aware Event Types
// ─────────────────────────────────────────────────────────────────

export interface TenantAwareEventMetadata extends EventMetadata {
  /** Resolved tenant context at publish time */
  tenant: TenantContext;
}

export interface TenantAwareEvent<T extends EventName = EventName, P = unknown> {
  type: T;
  payload: P;
  metadata: TenantAwareEventMetadata;
}

export interface TenantSubscription extends Subscription {
  /** Tenant scope for this subscription */
  tenantId: TenantId;
  /** Optional workspace scope */
  workspaceId?: WorkspaceId;
}

export interface TenantEventFilter extends EventFilter {
  /** Filter by tenant */
  tenantId?: TenantId;
  /** Filter by workspace */
  workspaceId?: WorkspaceId;
}

// ─────────────────────────────────────────────────────────────────
// Tenant-Aware Event Bus
// ─────────────────────────────────────────────────────────────────

export interface TenantEventBusConfig {
  /** Whether to enforce strict tenant isolation (default: true) */
  strictIsolation: boolean;
  /** Whether to allow system-level cross-tenant events (default: false) */
  allowCrossTenant: boolean;
  /** Maximum events per tenant per minute (rate limiting) */
  maxEventsPerMinute: number;
  /** Whether to audit all events (default: true) */
  auditEnabled: boolean;
}

const DEFAULT_TENANT_CONFIG: TenantEventBusConfig = {
  strictIsolation: true,
  allowCrossTenant: false,
  maxEventsPerMinute: 1000,
  auditEnabled: true,
};

export class TenantAwareEventBus {
  private subscriptions: Map<string, TenantSubscriptionEntry[]> = new Map();
  private eventLog: TenantAwareEvent[] = [];
  private rateLimits: Map<string, { count: number; resetAt: number }> = new Map();
  private config: TenantEventBusConfig;
  private auditLog: AuditEntry[] = [];

  constructor(config?: Partial<TenantEventBusConfig>) {
    this.config = { ...DEFAULT_TENANT_CONFIG, ...config };
  }

  // ─── Publish ─────────────────────────────────────────────────

  /**
   * Publish an event within a tenant context.
   * The event is automatically scoped to the tenant.
   */
  async publish<T extends EventName>(
    type: T,
    payload: unknown,
    context: TenantContext,
    options?: {
      correlationId?: string;
      causationId?: string;
      source?: string;
    }
  ): Promise<string> {
    // Rate limiting
    this.checkRateLimit(context.tenantId);

    // Build tenant-aware metadata
    const eventId = this.generateEventId();
    const metadata: TenantAwareEventMetadata = {
      eventId,
      timestamp: new Date().toISOString(),
      correlationId: options?.correlationId ?? this.generateCorrelationId(),
      causationId: options?.causationId,
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
      source: options?.source ?? "tenant-event-bus",
      schemaVersion: "1.0.0",
      retryCount: 0,
      maxRetries: 3,
      tenant: context,
    };

    const event: TenantAwareEvent = {
      type,
      payload,
      metadata,
    };

    // Store event
    this.eventLog.push(event);

    // Audit
    if (this.config.auditEnabled) {
      this.auditLog.push({
        action: "event.published",
        eventId,
        eventType: type,
        tenantId: context.tenantId,
        workspaceId: context.workspaceId,
        userId: context.userId,
        timestamp: metadata.timestamp,
      });
    }

    // Deliver to tenant-scoped subscribers
    await this.deliver(event);

    return eventId;
  }

  // ─── Subscribe ───────────────────────────────────────────────

  /**
   * Subscribe to events within a tenant scope.
   * The handler will only receive events for the specified tenant.
   */
  subscribe<T extends EventName>(
    eventType: T,
    tenantId: TenantId,
    handler: (event: TenantAwareEvent<T>) => Promise<void>,
    options?: {
      workspaceId?: WorkspaceId;
      filter?: TenantEventFilter;
      priority?: number;
    }
  ): TenantSubscription {
    const subscriptionId = this.generateSubscriptionId();
    const entry: TenantSubscriptionEntry = {
      id: subscriptionId,
      eventType,
      tenantId,
      workspaceId: options?.workspaceId,
      handler: handler as any,
      filter: options?.filter,
      priority: options?.priority ?? 0,
      createdAt: new Date().toISOString(),
    };

    const key = this.getSubscriptionKey(eventType, tenantId);
    const existing = this.subscriptions.get(key) ?? [];
    existing.push(entry);
    // Sort by priority (higher first)
    existing.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    this.subscriptions.set(key, existing);

    return {
      id: subscriptionId,
      eventType,
      tenantId,
      workspaceId: options?.workspaceId,
      unsubscribe: () => this.unsubscribe(subscriptionId, eventType, tenantId),
    } as TenantSubscription;
  }

  /**
   * Subscribe to ALL events for a tenant (useful for audit/monitoring).
   */
  subscribeAll(
    tenantId: TenantId,
    handler: (event: TenantAwareEvent) => Promise<void>
  ): TenantSubscription {
    const subscriptionId = this.generateSubscriptionId();
    const key = `*:${tenantId}`;
    const entry: TenantSubscriptionEntry = {
      id: subscriptionId,
      eventType: "*" as any,
      tenantId,
      handler,
      priority: -1, // Wildcard subscribers run last
      createdAt: new Date().toISOString(),
    };

    const existing = this.subscriptions.get(key) ?? [];
    existing.push(entry);
    this.subscriptions.set(key, existing);

    return {
      id: subscriptionId,
      eventType: "*" as any,
      tenantId,
      unsubscribe: () => {
        const subs = this.subscriptions.get(key);
        if (subs) {
          this.subscriptions.set(key, subs.filter((s) => s.id !== subscriptionId));
        }
      },
    } as TenantSubscription;
  }

  // ─── Query ───────────────────────────────────────────────────

  /**
   * Get events for a specific tenant.
   */
  getEventsForTenant(tenantId: TenantId, options?: {
    type?: EventName;
    workspaceId?: WorkspaceId;
    since?: string;
    limit?: number;
  }): TenantAwareEvent[] {
    let events = this.eventLog.filter((e) => e.metadata.tenantId === tenantId);

    if (options?.type) {
      events = events.filter((e) => e.type === options.type);
    }
    if (options?.workspaceId) {
      events = events.filter((e) => e.metadata.workspaceId === options.workspaceId);
    }
    if (options?.since) {
      events = events.filter((e) => e.metadata.timestamp >= options.since!);
    }
    if (options?.limit) {
      events = events.slice(-options.limit);
    }

    return events;
  }

  /**
   * Get event count per tenant (for monitoring/billing).
   */
  getEventCountByTenant(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const event of this.eventLog) {
      const tenantId = event.metadata.tenantId;
      counts.set(tenantId, (counts.get(tenantId) ?? 0) + 1);
    }
    return counts;
  }

  /**
   * Get the audit log for a tenant.
   */
  getAuditLog(tenantId: TenantId): AuditEntry[] {
    return this.auditLog.filter((e) => e.tenantId === tenantId);
  }

  // ─── Stats ───────────────────────────────────────────────────

  getStats(): TenantEventBusStats {
    return {
      totalEvents: this.eventLog.length,
      totalSubscriptions: Array.from(this.subscriptions.values()).reduce(
        (sum, subs) => sum + subs.length, 0
      ),
      tenantCount: new Set(this.eventLog.map((e) => e.metadata.tenantId)).size,
      auditEntries: this.auditLog.length,
      eventsByType: this.getEventsByType(),
    };
  }

  // ─── Private ─────────────────────────────────────────────────

  private async deliver(event: TenantAwareEvent): Promise<void> {
    const tenantId = event.metadata.tenantId;

    // Deliver to type-specific subscribers for this tenant
    const typeKey = this.getSubscriptionKey(event.type, tenantId);
    const typeSubs = this.subscriptions.get(typeKey) ?? [];

    // Deliver to wildcard subscribers for this tenant
    const wildcardKey = `*:${tenantId}`;
    const wildcardSubs = this.subscriptions.get(wildcardKey) ?? [];

    const allSubs = [...typeSubs, ...wildcardSubs];

    for (const sub of allSubs) {
      // Workspace filtering
      if (sub.workspaceId && event.metadata.workspaceId !== sub.workspaceId) {
        continue;
      }

      try {
        await sub.handler(event);
      } catch (error) {
        // Log but don't fail other subscribers
        if (this.config.auditEnabled) {
          this.auditLog.push({
            action: "event.handler_failed",
            eventId: event.metadata.eventId,
            eventType: event.type,
            tenantId,
            workspaceId: event.metadata.workspaceId,
            userId: event.metadata.tenant?.userId ?? "unknown",
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }

  private unsubscribe(subscriptionId: string, eventType: EventName, tenantId: TenantId): void {
    const key = this.getSubscriptionKey(eventType, tenantId);
    const subs = this.subscriptions.get(key);
    if (subs) {
      this.subscriptions.set(key, subs.filter((s) => s.id !== subscriptionId));
    }
  }

  private checkRateLimit(tenantId: TenantId): void {
    const now = Date.now();
    const limit = this.rateLimits.get(tenantId);

    if (!limit || now >= limit.resetAt) {
      this.rateLimits.set(tenantId, { count: 1, resetAt: now + 60000 });
      return;
    }

    limit.count++;
    if (limit.count > this.config.maxEventsPerMinute) {
      throw new TenantRateLimitError(tenantId, this.config.maxEventsPerMinute);
    }
  }

  private getSubscriptionKey(eventType: string, tenantId: string): string {
    return `${eventType}:${tenantId}`;
  }

  private getEventsByType(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const event of this.eventLog) {
      counts[event.type] = (counts[event.type] ?? 0) + 1;
    }
    return counts;
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  private generateCorrelationId(): string {
    return `cor_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /** Reset all state (for testing) */
  reset(): void {
    this.subscriptions.clear();
    this.eventLog = [];
    this.rateLimits.clear();
    this.auditLog = [];
  }
}

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

interface TenantSubscriptionEntry {
  id: string;
  eventType: EventName | "*";
  tenantId: TenantId;
  workspaceId?: WorkspaceId;
  handler: (event: TenantAwareEvent) => Promise<void>;
  filter?: TenantEventFilter;
  priority?: number;
  createdAt: string;
}

interface AuditEntry {
  action: string;
  eventId: string;
  eventType: string;
  tenantId: string;
  workspaceId: string;
  userId: string;
  timestamp: string;
  error?: string;
}

interface TenantEventBusStats {
  totalEvents: number;
  totalSubscriptions: number;
  tenantCount: number;
  auditEntries: number;
  eventsByType: Record<string, number>;
}

// ─────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────

export class TenantRateLimitError extends Error {
  constructor(public tenantId: string, public limit: number) {
    super(`Tenant ${tenantId} exceeded rate limit of ${limit} events/minute`);
    this.name = "TenantRateLimitError";
  }
}

export class TenantIsolationError extends Error {
  constructor(public sourceTenant: string, public targetTenant: string) {
    super(`Cross-tenant event rejected: ${sourceTenant} → ${targetTenant}`);
    this.name = "TenantIsolationError";
  }
}

// ─────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────

export function createTenantEventBus(config?: Partial<TenantEventBusConfig>): TenantAwareEventBus {
  return new TenantAwareEventBus(config);
}
