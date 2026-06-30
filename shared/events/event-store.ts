/**
 * D3VONN Event Bus — Event Store (Persistence Adapter)
 *
 * Provides event persistence with pluggable backends. Ships with:
 * - InMemoryEventStore: For testing and development
 * - FileEventStore: Append-only JSON log for single-node deployments
 *
 * Production adapters (PostgreSQL, Redis Streams, Kafka) can implement
 * the EventStoreAdapter interface.
 *
 * @module shared/events/event-store
 * @version 1.0.0
 */

import {
  AnyEvent,
  EventName,
  EventStoreEntry,
  ReplayOptions,
  TenantId,
  CorrelationId,
} from "./event-types";
import { EventStoreAdapter } from "./event-bus";

// ─────────────────────────────────────────────────────────────────
// In-Memory Event Store
// ─────────────────────────────────────────────────────────────────

/**
 * In-memory event store for testing and development.
 * Events are lost on process restart.
 */
export class InMemoryEventStore implements EventStoreAdapter {
  private events: EventStoreEntry[] = [];
  private sequence = 0;
  private maxSize: number;

  constructor(options: { maxSize?: number } = {}) {
    this.maxSize = options.maxSize ?? 100000;
  }

  async append(event: AnyEvent): Promise<void> {
    this.sequence++;
    const entry: EventStoreEntry = {
      sequenceNumber: this.sequence,
      event,
      storedAt: new Date().toISOString(),
      partition: event.metadata.correlationId || "default",
    };
    this.events.push(entry);

    // Trim if over max size
    if (this.events.length > this.maxSize) {
      this.events = this.events.slice(-Math.floor(this.maxSize * 0.8));
    }
  }

  async query(options: ReplayOptions): Promise<{ event: AnyEvent; sequenceNumber: number }[]> {
    let results = [...this.events];

    if (options.fromSequence !== undefined) {
      results = results.filter((e) => e.sequenceNumber >= options.fromSequence!);
    }
    if (options.toSequence !== undefined) {
      results = results.filter((e) => e.sequenceNumber <= options.toSequence!);
    }
    if (options.fromTimestamp) {
      results = results.filter((e) => e.storedAt >= options.fromTimestamp!);
    }
    if (options.toTimestamp) {
      results = results.filter((e) => e.storedAt <= options.toTimestamp!);
    }
    if (options.eventTypes && options.eventTypes.length > 0) {
      results = results.filter((e) => options.eventTypes!.includes(e.event.type));
    }
    if (options.tenantId) {
      results = results.filter((e) => e.event.metadata.tenantId === options.tenantId);
    }
    if (options.correlationId) {
      results = results.filter((e) => e.event.metadata.correlationId === options.correlationId);
    }

    return results.map((e) => ({ event: e.event, sequenceNumber: e.sequenceNumber }));
  }

  async flush(): Promise<void> {
    // No-op for in-memory
  }

  async getSequence(): Promise<number> {
    return this.sequence;
  }

  /** Get all stored events (for testing) */
  getAll(): EventStoreEntry[] {
    return [...this.events];
  }

  /** Get events by correlation ID */
  async getByCorrelation(correlationId: CorrelationId): Promise<EventStoreEntry[]> {
    return this.events.filter((e) => e.event.metadata.correlationId === correlationId);
  }

  /** Get events by tenant */
  async getByTenant(tenantId: TenantId): Promise<EventStoreEntry[]> {
    return this.events.filter((e) => e.event.metadata.tenantId === tenantId);
  }

  /** Get event count by type */
  getCountByType(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const entry of this.events) {
      counts[entry.event.type] = (counts[entry.event.type] || 0) + 1;
    }
    return counts;
  }

  /** Clear all events (for testing) */
  clear(): void {
    this.events = [];
    this.sequence = 0;
  }

  /** Get store size */
  get size(): number {
    return this.events.length;
  }
}

// ─────────────────────────────────────────────────────────────────
// File-Based Event Store
// ─────────────────────────────────────────────────────────────────

/**
 * File-based append-only event store.
 * Each event is written as a JSON line to a log file.
 * Suitable for single-node deployments and local development.
 *
 * Note: This implementation uses Node.js fs module.
 * For browser environments, use InMemoryEventStore.
 */
export class FileEventStore implements EventStoreAdapter {
  private filePath: string;
  private buffer: EventStoreEntry[] = [];
  private sequence = 0;
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private bufferSize: number;

  constructor(options: { filePath: string; bufferSize?: number; flushIntervalMs?: number }) {
    this.filePath = options.filePath;
    this.bufferSize = options.bufferSize ?? 100;

    // Auto-flush on interval
    if (options.flushIntervalMs) {
      this.flushInterval = setInterval(() => {
        this.flush().catch(console.error);
      }, options.flushIntervalMs);
    }
  }

  async append(event: AnyEvent): Promise<void> {
    this.sequence++;
    const entry: EventStoreEntry = {
      sequenceNumber: this.sequence,
      event,
      storedAt: new Date().toISOString(),
      partition: event.metadata.correlationId || "default",
    };
    this.buffer.push(entry);

    if (this.buffer.length >= this.bufferSize) {
      await this.flush();
    }
  }

  async query(options: ReplayOptions): Promise<{ event: AnyEvent; sequenceNumber: number }[]> {
    // Flush buffer first to ensure all events are on disk
    await this.flush();

    // Read and parse the log file
    const entries = await this.readLogFile();
    let results = entries;

    if (options.fromSequence !== undefined) {
      results = results.filter((e) => e.sequenceNumber >= options.fromSequence!);
    }
    if (options.toSequence !== undefined) {
      results = results.filter((e) => e.sequenceNumber <= options.toSequence!);
    }
    if (options.fromTimestamp) {
      results = results.filter((e) => e.storedAt >= options.fromTimestamp!);
    }
    if (options.toTimestamp) {
      results = results.filter((e) => e.storedAt <= options.toTimestamp!);
    }
    if (options.eventTypes && options.eventTypes.length > 0) {
      results = results.filter((e) => options.eventTypes!.includes(e.event.type));
    }
    if (options.tenantId) {
      results = results.filter((e) => e.event.metadata.tenantId === options.tenantId);
    }
    if (options.correlationId) {
      results = results.filter((e) => e.event.metadata.correlationId === options.correlationId);
    }

    return results.map((e) => ({ event: e.event, sequenceNumber: e.sequenceNumber }));
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    try {
      const fs = await import("fs/promises");
      const lines = this.buffer.map((entry) => JSON.stringify(entry)).join("\n") + "\n";
      await fs.appendFile(this.filePath, lines, "utf-8");
      this.buffer = [];
    } catch (error) {
      console.error("[EventStore] Failed to flush to file:", error);
    }
  }

  async getSequence(): Promise<number> {
    return this.sequence;
  }

  /** Shutdown and flush remaining events */
  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    await this.flush();
  }

  private async readLogFile(): Promise<EventStoreEntry[]> {
    try {
      const fs = await import("fs/promises");
      const content = await fs.readFile(this.filePath, "utf-8");
      return content
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as EventStoreEntry);
    } catch (error) {
      // File doesn't exist yet
      return [];
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Partitioned Event Store (Multi-Tenant)
// ─────────────────────────────────────────────────────────────────

/**
 * Wraps any EventStoreAdapter to add tenant-based partitioning.
 * Routes events to tenant-specific stores for isolation.
 */
export class PartitionedEventStore implements EventStoreAdapter {
  private stores: Map<string, EventStoreAdapter> = new Map();
  private factory: (tenantId: string) => EventStoreAdapter;
  private defaultStore: EventStoreAdapter;

  constructor(options: {
    factory: (tenantId: string) => EventStoreAdapter;
    defaultStore: EventStoreAdapter;
  }) {
    this.factory = options.factory;
    this.defaultStore = options.defaultStore;
  }

  private getStore(tenantId: string): EventStoreAdapter {
    if (!this.stores.has(tenantId)) {
      this.stores.set(tenantId, this.factory(tenantId));
    }
    return this.stores.get(tenantId)!;
  }

  async append(event: AnyEvent): Promise<void> {
    const tenantId = event.metadata.tenantId;
    const store = tenantId ? this.getStore(tenantId) : this.defaultStore;
    await store.append(event);
  }

  async query(options: ReplayOptions): Promise<{ event: AnyEvent; sequenceNumber: number }[]> {
    if (options.tenantId) {
      const store = this.getStore(options.tenantId);
      return store.query(options);
    }
    // Query all stores
    const results: { event: AnyEvent; sequenceNumber: number }[] = [];
    for (const store of this.stores.values()) {
      results.push(...(await store.query(options)));
    }
    results.push(...(await this.defaultStore.query(options)));
    // Sort by sequence
    results.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    return results;
  }

  async flush(): Promise<void> {
    await this.defaultStore.flush();
    for (const store of this.stores.values()) {
      await store.flush();
    }
  }

  async getSequence(): Promise<number> {
    let max = await this.defaultStore.getSequence();
    for (const store of this.stores.values()) {
      const seq = await store.getSequence();
      if (seq > max) max = seq;
    }
    return max;
  }
}

// ─────────────────────────────────────────────────────────────────
// Factory Functions
// ─────────────────────────────────────────────────────────────────

/** Create an in-memory event store */
export function createInMemoryStore(options?: { maxSize?: number }): InMemoryEventStore {
  return new InMemoryEventStore(options);
}

/** Create a file-based event store */
export function createFileStore(options: {
  filePath: string;
  bufferSize?: number;
  flushIntervalMs?: number;
}): FileEventStore {
  return new FileEventStore(options);
}

/** Create a partitioned (multi-tenant) event store */
export function createPartitionedStore(options: {
  factory: (tenantId: string) => EventStoreAdapter;
  defaultStore?: EventStoreAdapter;
}): PartitionedEventStore {
  return new PartitionedEventStore({
    factory: options.factory,
    defaultStore: options.defaultStore ?? new InMemoryEventStore(),
  });
}
