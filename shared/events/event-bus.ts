/**
 * D3VONN Event Bus — Core Runtime
 *
 * In-process event bus with typed publish/subscribe, dead-letter queue,
 * replay support, ordered delivery, and middleware pipeline.
 *
 * Design decisions:
 * - Single-process first (can be swapped for Redis/Kafka adapter later)
 * - Ordered delivery within a partition (correlationId)
 * - At-least-once semantics with idempotency support
 * - Dead-letter queue for failed handlers after max retries
 * - Replay from event store for recovery/debugging
 *
 * @module shared/events/event-bus
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
  DeadLetterEntry,
  ReplayOptions,
} from "./event-types";
import { validateEvent, ValidationResult } from "./event-schema";

// ─────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────

export type EventMiddleware = (
  event: AnyEvent,
  next: () => Promise<void>
) => Promise<void>;

// ─────────────────────────────────────────────────────────────────
// Event Bus Configuration
// ─────────────────────────────────────────────────────────────────

export interface EventBusConfig {
  /** Maximum retries before dead-lettering (default: 3) */
  maxRetries: number;
  /** Default handler timeout in ms (default: 30000) */
  defaultTimeoutMs: number;
  /** Enable runtime validation on publish (default: true) */
  validateOnPublish: boolean;
  /** Enable runtime validation on subscribe delivery (default: false) */
  validateOnDeliver: boolean;
  /** Enable idempotency check (default: true) */
  enableIdempotency: boolean;
  /** Idempotency window in ms (default: 300000 = 5 min) */
  idempotencyWindowMs: number;
  /** Maximum dead-letter queue size (default: 10000) */
  maxDeadLetterSize: number;
  /** Enable ordered delivery within correlation (default: true) */
  orderedDelivery: boolean;
}

const DEFAULT_CONFIG: EventBusConfig = {
  maxRetries: 3,
  defaultTimeoutMs: 30000,
  validateOnPublish: true,
  validateOnDeliver: false,
  enableIdempotency: true,
  idempotencyWindowMs: 300000,
  maxDeadLetterSize: 10000,
  orderedDelivery: true,
};

// ─────────────────────────────────────────────────────────────────
// Event Bus Statistics
// ─────────────────────────────────────────────────────────────────

export interface EventBusStats {
  totalPublished: number;
  totalDelivered: number;
  totalFailed: number;
  totalDeadLettered: number;
  totalReplayed: number;
  activeSubscriptions: number;
  deadLetterQueueSize: number;
  publishedByType: Record<string, number>;
  averageDeliveryMs: number;
}

// ─────────────────────────────────────────────────────────────────
// Event Bus Implementation
// ─────────────────────────────────────────────────────────────────

export class D3VONNEventBus {
  private config: EventBusConfig;
  private subscriptions: Map<EventName, Subscription[]> = new Map();
  private middleware: EventMiddleware[] = [];
  private deadLetterQueue: DeadLetterEntry[] = [];
  private processedEventIds: Set<string> = new Set();
  private idempotencyTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  // Statistics
  private stats: EventBusStats = {
    totalPublished: 0,
    totalDelivered: 0,
    totalFailed: 0,
    totalDeadLettered: 0,
    totalReplayed: 0,
    activeSubscriptions: 0,
    deadLetterQueueSize: 0,
    publishedByType: {},
    averageDeliveryMs: 0,
  };
  private deliveryTimes: number[] = [];

  // Event store adapter (optional)
  private eventStore: EventStoreAdapter | null = null;

  // Lifecycle hooks
  private onDeadLetter: ((entry: DeadLetterEntry) => void) | null = null;
  private onPublish: ((event: AnyEvent) => void) | null = null;

  constructor(config: Partial<EventBusConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ─────────────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────────────

  /** Attach an event store for persistence and replay */
  setEventStore(store: EventStoreAdapter): void {
    this.eventStore = store;
  }

  /** Register a dead-letter callback */
  onDeadLetterEvent(callback: (entry: DeadLetterEntry) => void): void {
    this.onDeadLetter = callback;
  }

  /** Register a publish callback (for audit logging) */
  onPublishEvent(callback: (event: AnyEvent) => void): void {
    this.onPublish = callback;
  }

  /** Add middleware to the processing pipeline */
  use(middleware: EventMiddleware): void {
    this.middleware.push(middleware);
  }

  // ─────────────────────────────────────────────────────────────
  // Publish
  // ─────────────────────────────────────────────────────────────

  /**
   * Publish a typed event to the bus.
   * Validates the event, runs middleware, persists to store, and delivers to subscribers.
   */
  async publish<T extends EventName>(event: TypedEvent<T>): Promise<PublishResult> {
    // Idempotency check
    if (this.config.enableIdempotency) {
      if (this.processedEventIds.has(event.metadata.eventId)) {
        return { success: true, deduplicated: true, deliveredTo: 0 };
      }
    }

    // Runtime validation
    if (this.config.validateOnPublish) {
      const validation = validateEvent(event);
      if (!validation.valid) {
        return { success: false, deduplicated: false, deliveredTo: 0, validationErrors: validation.errors };
      }
    }

    // Track idempotency
    if (this.config.enableIdempotency) {
      this.processedEventIds.add(event.metadata.eventId);
      const timer = setTimeout(() => {
        this.processedEventIds.delete(event.metadata.eventId);
        this.idempotencyTimers.delete(event.metadata.eventId);
      }, this.config.idempotencyWindowMs);
      this.idempotencyTimers.set(event.metadata.eventId, timer);
    }

    // Update stats
    this.stats.totalPublished++;
    this.stats.publishedByType[event.type] = (this.stats.publishedByType[event.type] || 0) + 1;

    // Publish callback (audit)
    if (this.onPublish) {
      this.onPublish(event as AnyEvent);
    }

    // Persist to event store
    if (this.eventStore) {
      await this.eventStore.append(event as AnyEvent);
    }

    // Run middleware pipeline then deliver
    let deliveredTo = 0;
    const deliverFn = async () => {
      deliveredTo = await this.deliver(event as AnyEvent);
    };

    if (this.middleware.length > 0) {
      await this.runMiddleware(event as AnyEvent, deliverFn);
    } else {
      await deliverFn();
    }

    return { success: true, deduplicated: false, deliveredTo };
  }

  // ─────────────────────────────────────────────────────────────
  // Subscribe
  // ─────────────────────────────────────────────────────────────

  /**
   * Subscribe to a specific event type with a typed handler.
   */
  subscribe<T extends EventName>(
    eventType: T,
    handler: EventHandler<T>,
    options: Partial<SubscribeOptions> = {}
  ): string {
    const subscriptionId = generateId();

    const subscription: Subscription = {
      id: subscriptionId,
      eventType,
      handler: handler as EventHandler<any>,
      filter: options.filter,
      priority: options.priority ?? 0,
      maxRetries: options.maxRetries ?? this.config.maxRetries,
      timeoutMs: options.timeoutMs ?? this.config.defaultTimeoutMs,
      deadLetterOnFailure: options.deadLetterOnFailure ?? true,
    };

    const existing = this.subscriptions.get(eventType) || [];
    existing.push(subscription);
    // Sort by priority (higher first)
    existing.sort((a, b) => b.priority - a.priority);
    this.subscriptions.set(eventType, existing);

    this.stats.activeSubscriptions++;
    return subscriptionId;
  }

  /**
   * Subscribe to multiple event types with the same handler.
   */
  subscribeMany(
    eventTypes: EventName[],
    handler: EventHandler<any>,
    options: Partial<SubscribeOptions> = {}
  ): string[] {
    return eventTypes.map((type) => this.subscribe(type, handler, options));
  }

  /**
   * Unsubscribe by subscription ID.
   */
  unsubscribe(subscriptionId: string): boolean {
    for (const [eventType, subs] of this.subscriptions.entries()) {
      const idx = subs.findIndex((s) => s.id === subscriptionId);
      if (idx !== -1) {
        subs.splice(idx, 1);
        this.stats.activeSubscriptions--;
        return true;
      }
    }
    return false;
  }

  /**
   * Unsubscribe all handlers for an event type.
   */
  unsubscribeAll(eventType?: EventName): void {
    if (eventType) {
      const count = this.subscriptions.get(eventType)?.length || 0;
      this.subscriptions.delete(eventType);
      this.stats.activeSubscriptions -= count;
    } else {
      this.subscriptions.clear();
      this.stats.activeSubscriptions = 0;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Replay
  // ─────────────────────────────────────────────────────────────

  /**
   * Replay events from the event store through current subscribers.
   */
  async replay(options: ReplayOptions = {}): Promise<ReplayResult> {
    if (!this.eventStore) {
      throw new Error("No event store configured. Call setEventStore() first.");
    }

    const events = await this.eventStore.query(options);
    let delivered = 0;
    let failed = 0;

    for (const entry of events) {
      try {
        await this.deliver(entry.event, true);
        delivered++;
      } catch {
        failed++;
      }
    }

    this.stats.totalReplayed += delivered;
    return { total: events.length, delivered, failed };
  }

  // ─────────────────────────────────────────────────────────────
  // Dead Letter Queue
  // ─────────────────────────────────────────────────────────────

  /** Get all dead-letter entries */
  getDeadLetterQueue(): readonly DeadLetterEntry[] {
    return this.deadLetterQueue;
  }

  /** Retry a specific dead-letter entry */
  async retryDeadLetter(index: number): Promise<boolean> {
    const entry = this.deadLetterQueue[index];
    if (!entry || entry.resolved) return false;

    try {
      await this.deliver(entry.event);
      entry.resolved = true;
      this.stats.deadLetterQueueSize--;
      return true;
    } catch {
      return false;
    }
  }

  /** Retry all unresolved dead-letter entries */
  async retryAllDeadLetters(): Promise<{ succeeded: number; failed: number }> {
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < this.deadLetterQueue.length; i++) {
      if (!this.deadLetterQueue[i].resolved) {
        const result = await this.retryDeadLetter(i);
        if (result) succeeded++;
        else failed++;
      }
    }

    return { succeeded, failed };
  }

  /** Purge resolved dead-letter entries */
  purgeResolvedDeadLetters(): number {
    const before = this.deadLetterQueue.length;
    this.deadLetterQueue = this.deadLetterQueue.filter((e) => !e.resolved);
    return before - this.deadLetterQueue.length;
  }

  // ─────────────────────────────────────────────────────────────
  // Statistics & Introspection
  // ─────────────────────────────────────────────────────────────

  /** Get current bus statistics */
  getStats(): EventBusStats {
    return {
      ...this.stats,
      deadLetterQueueSize: this.deadLetterQueue.filter((e) => !e.resolved).length,
      averageDeliveryMs:
        this.deliveryTimes.length > 0
          ? this.deliveryTimes.reduce((a, b) => a + b, 0) / this.deliveryTimes.length
          : 0,
    };
  }

  /** Get all subscriptions for an event type */
  getSubscriptions(eventType?: EventName): Subscription[] {
    if (eventType) {
      return [...(this.subscriptions.get(eventType) || [])];
    }
    const all: Subscription[] = [];
    for (const subs of this.subscriptions.values()) {
      all.push(...subs);
    }
    return all;
  }

  /** Check if an event type has any subscribers */
  hasSubscribers(eventType: EventName): boolean {
    return (this.subscriptions.get(eventType)?.length || 0) > 0;
  }

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────

  /** Graceful shutdown — flush pending events and clear timers */
  async shutdown(): Promise<void> {
    for (const timer of this.idempotencyTimers.values()) {
      clearTimeout(timer);
    }
    this.idempotencyTimers.clear();
    this.processedEventIds.clear();

    if (this.eventStore) {
      await this.eventStore.flush();
    }
  }

  /** Reset the bus (for testing) */
  reset(): void {
    this.subscriptions.clear();
    this.middleware = [];
    this.deadLetterQueue = [];
    this.processedEventIds.clear();
    for (const timer of this.idempotencyTimers.values()) {
      clearTimeout(timer);
    }
    this.idempotencyTimers.clear();
    this.stats = {
      totalPublished: 0,
      totalDelivered: 0,
      totalFailed: 0,
      totalDeadLettered: 0,
      totalReplayed: 0,
      activeSubscriptions: 0,
      deadLetterQueueSize: 0,
      publishedByType: {},
      averageDeliveryMs: 0,
    };
    this.deliveryTimes = [];
  }

  // ─────────────────────────────────────────────────────────────
  // Private: Delivery
  // ─────────────────────────────────────────────────────────────

  private async deliver(event: AnyEvent, isReplay = false): Promise<number> {
    const subscribers = this.subscriptions.get(event.type) || [];
    let deliveredCount = 0;

    for (const sub of subscribers) {
      // Apply filter
      if (sub.filter && !this.matchesFilter(event, sub.filter)) {
        continue;
      }

      const startTime = Date.now();

      try {
        await this.executeWithTimeout(
          () => sub.handler(event as any),
          sub.timeoutMs
        );
        deliveredCount++;
        this.stats.totalDelivered++;
        this.deliveryTimes.push(Date.now() - startTime);

        // Keep delivery times bounded
        if (this.deliveryTimes.length > 1000) {
          this.deliveryTimes = this.deliveryTimes.slice(-500);
        }
      } catch (error) {
        this.stats.totalFailed++;
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Retry logic
        if (event.metadata.retryCount < sub.maxRetries) {
          // Increment retry and re-deliver
          const retryEvent = {
            ...event,
            metadata: {
              ...event.metadata,
              retryCount: event.metadata.retryCount + 1,
            },
          };
          try {
            await this.executeWithTimeout(
              () => sub.handler(retryEvent as any),
              sub.timeoutMs
            );
            deliveredCount++;
            this.stats.totalDelivered++;
          } catch (retryError) {
            // Dead-letter after final retry
            if (sub.deadLetterOnFailure) {
              this.addToDeadLetter(event, sub.id, errorMessage);
            }
          }
        } else if (sub.deadLetterOnFailure) {
          this.addToDeadLetter(event, sub.id, errorMessage);
        }
      }
    }

    return deliveredCount;
  }

  private addToDeadLetter(event: AnyEvent, subscriptionId: string, error: string): void {
    const entry: DeadLetterEntry = {
      event,
      subscriptionId,
      error,
      failedAt: new Date().toISOString(),
      retryCount: event.metadata.retryCount,
      resolved: false,
    };

    this.deadLetterQueue.push(entry);
    this.stats.totalDeadLettered++;
    this.stats.deadLetterQueueSize++;

    // Trim if over limit
    if (this.deadLetterQueue.length > this.config.maxDeadLetterSize) {
      this.deadLetterQueue = this.deadLetterQueue.slice(-this.config.maxDeadLetterSize);
    }

    if (this.onDeadLetter) {
      this.onDeadLetter(entry);
    }
  }

  private matchesFilter(event: AnyEvent, filter: EventFilter): boolean {
    if (filter.tenantId && event.metadata.tenantId !== filter.tenantId) return false;
    if (filter.workspaceId && event.metadata.workspaceId !== filter.workspaceId) return false;
    if (filter.source && event.metadata.source !== filter.source) return false;
    if (filter.payloadMatch) {
      const payload = event.payload as Record<string, unknown>;
      for (const [key, value] of Object.entries(filter.payloadMatch)) {
        if (payload[key] !== value) return false;
      }
    }
    return true;
  }

  private async executeWithTimeout(fn: () => Promise<void> | void, timeoutMs: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Handler timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      Promise.resolve(fn())
        .then(() => {
          clearTimeout(timer);
          resolve();
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  private async runMiddleware(event: AnyEvent, finalHandler: () => Promise<void>): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < this.middleware.length) {
        const mw = this.middleware[index++];
        await mw(event, next);
      } else {
        await finalHandler();
      }
    };

    await next();
  }
}

// ─────────────────────────────────────────────────────────────────
// Event Store Adapter Interface
// ─────────────────────────────────────────────────────────────────

export interface EventStoreAdapter {
  /** Append an event to the store */
  append(event: AnyEvent): Promise<void>;
  /** Query events with filters */
  query(options: ReplayOptions): Promise<{ event: AnyEvent; sequenceNumber: number }[]>;
  /** Flush pending writes */
  flush(): Promise<void>;
  /** Get the current sequence number */
  getSequence(): Promise<number>;
}

// ─────────────────────────────────────────────────────────────────
// Result Types
// ─────────────────────────────────────────────────────────────────

export interface PublishResult {
  success: boolean;
  deduplicated: boolean;
  deliveredTo: number;
  validationErrors?: { path: string; message: string }[];
}

export interface ReplayResult {
  total: number;
  delivered: number;
  failed: number;
}

export interface SubscribeOptions {
  filter?: EventFilter;
  priority?: number;
  maxRetries?: number;
  timeoutMs?: number;
  deadLetterOnFailure?: boolean;
}

// ─────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

// ─────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────

/** Create a new event bus instance with default configuration */
export function createEventBus(config?: Partial<EventBusConfig>): D3VONNEventBus {
  return new D3VONNEventBus(config);
}

/** Create event metadata helper */
export function createMetadata(
  source: string,
  tenantId: string,
  workspaceId: string,
  options: {
    correlationId?: string;
    causationId?: string;
    maxRetries?: number;
  } = {}
): EventMetadata {
  return {
    eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    timestamp: new Date().toISOString(),
    correlationId: options.correlationId || `cor_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    causationId: options.causationId,
    tenantId,
    workspaceId,
    source,
    schemaVersion: "1.0.0",
    retryCount: 0,
    maxRetries: options.maxRetries ?? 3,
  };
}
