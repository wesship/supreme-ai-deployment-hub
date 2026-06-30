/**
 * D3VONN Multi-Tenant Foundations — Agent Memory Isolation
 *
 * Provides tenant-isolated memory storage for agents. Each agent's
 * memory is scoped to its tenant and cannot be accessed by other tenants.
 *
 * Memory types:
 * - Episodic: Task execution history and outcomes
 * - Semantic: Learned knowledge and facts
 * - Procedural: How-to patterns and workflows
 * - Working: Short-term task context (auto-expires)
 *
 * @module shared/tenancy/tenant-memory
 * @version 1.0.0
 */

import { TenantContext, TenantId, WorkspaceId } from "./types";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type MemoryType = "episodic" | "semantic" | "procedural" | "working";

export interface MemoryEntry {
  id: string;
  tenantId: TenantId;
  workspaceId: WorkspaceId;
  agentId: string;
  key: string;
  value: unknown;
  type: MemoryType;
  metadata: MemoryMetadata;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export interface MemoryMetadata {
  /** Source event that created this memory */
  sourceEventId?: string;
  /** Confidence score (0-1) */
  confidence?: number;
  /** Tags for categorization */
  tags?: string[];
  /** Number of times accessed */
  accessCount: number;
  /** Last accessed timestamp */
  lastAccessedAt?: string;
  /** Size in bytes (approximate) */
  sizeBytes: number;
}

export interface MemoryQuery {
  agentId?: string;
  type?: MemoryType;
  keyPrefix?: string;
  tags?: string[];
  minConfidence?: number;
  since?: string;
  limit?: number;
  offset?: number;
}

export interface MemoryStats {
  totalEntries: number;
  byType: Record<MemoryType, number>;
  totalSizeBytes: number;
  oldestEntry?: string;
  newestEntry?: string;
}

// ─────────────────────────────────────────────────────────────────
// Tenant-Aware Memory Store
// ─────────────────────────────────────────────────────────────────

export class TenantAwareMemoryStore {
  private store: Map<string, MemoryEntry> = new Map();
  private tenantIndex: Map<string, Set<string>> = new Map();
  private agentIndex: Map<string, Set<string>> = new Map();

  // ─── Write Operations ────────────────────────────────────────

  /**
   * Store a memory entry, scoped to the tenant context.
   */
  async set(
    context: TenantContext,
    agentId: string,
    key: string,
    value: unknown,
    options?: {
      type?: MemoryType;
      confidence?: number;
      tags?: string[];
      ttlMs?: number;
      sourceEventId?: string;
    }
  ): Promise<MemoryEntry> {
    const compositeKey = this.buildKey(context.tenantId, agentId, key);
    const now = new Date().toISOString();

    const existing = this.store.get(compositeKey);
    const entry: MemoryEntry = {
      id: existing?.id ?? this.generateId(),
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
      agentId,
      key,
      value,
      type: options?.type ?? "episodic",
      metadata: {
        sourceEventId: options?.sourceEventId,
        confidence: options?.confidence ?? 1.0,
        tags: options?.tags ?? [],
        accessCount: existing?.metadata.accessCount ?? 0,
        lastAccessedAt: existing?.metadata.lastAccessedAt,
        sizeBytes: this.estimateSize(value),
      },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      expiresAt: options?.ttlMs
        ? new Date(Date.now() + options.ttlMs).toISOString()
        : undefined,
    };

    this.store.set(compositeKey, entry);
    this.indexEntry(entry);

    return entry;
  }

  /**
   * Delete a memory entry.
   */
  async delete(context: TenantContext, agentId: string, key: string): Promise<boolean> {
    const compositeKey = this.buildKey(context.tenantId, agentId, key);
    const entry = this.store.get(compositeKey);

    if (!entry) return false;

    // Verify tenant isolation
    if (entry.tenantId !== context.tenantId) {
      throw new MemoryIsolationError(context.tenantId, entry.tenantId);
    }

    this.store.delete(compositeKey);
    this.removeFromIndex(entry);
    return true;
  }

  /**
   * Delete all memory for an agent within a tenant.
   */
  async deleteAgentMemory(context: TenantContext, agentId: string): Promise<number> {
    const agentKey = `${context.tenantId}:${agentId}`;
    const entryIds = this.agentIndex.get(agentKey);
    if (!entryIds) return 0;

    let count = 0;
    for (const compositeKey of entryIds) {
      const entry = this.store.get(compositeKey);
      if (entry && entry.tenantId === context.tenantId) {
        this.store.delete(compositeKey);
        count++;
      }
    }

    this.agentIndex.delete(agentKey);
    return count;
  }

  // ─── Read Operations ─────────────────────────────────────────

  /**
   * Get a specific memory entry.
   * Enforces tenant isolation — only returns entries for the given tenant.
   */
  async get(context: TenantContext, agentId: string, key: string): Promise<MemoryEntry | null> {
    const compositeKey = this.buildKey(context.tenantId, agentId, key);
    const entry = this.store.get(compositeKey);

    if (!entry) return null;

    // Verify tenant isolation
    if (entry.tenantId !== context.tenantId) {
      return null; // Silent isolation — don't reveal existence
    }

    // Check expiration
    if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
      this.store.delete(compositeKey);
      return null;
    }

    // Update access metadata
    entry.metadata.accessCount++;
    entry.metadata.lastAccessedAt = new Date().toISOString();

    return entry;
  }

  /**
   * Query memory entries for a tenant.
   */
  async query(context: TenantContext, query: MemoryQuery): Promise<MemoryEntry[]> {
    const tenantEntryKeys = this.tenantIndex.get(context.tenantId);
    if (!tenantEntryKeys) return [];

    let results: MemoryEntry[] = [];

    for (const compositeKey of tenantEntryKeys) {
      const entry = this.store.get(compositeKey);
      if (!entry) continue;

      // Check expiration
      if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
        this.store.delete(compositeKey);
        continue;
      }

      // Apply filters
      if (query.agentId && entry.agentId !== query.agentId) continue;
      if (query.type && entry.type !== query.type) continue;
      if (query.keyPrefix && !entry.key.startsWith(query.keyPrefix)) continue;
      if (query.minConfidence && (entry.metadata.confidence ?? 0) < query.minConfidence) continue;
      if (query.since && entry.createdAt < query.since) continue;
      if (query.tags && query.tags.length > 0) {
        const entryTags = entry.metadata.tags ?? [];
        if (!query.tags.some((tag) => entryTags.includes(tag))) continue;
      }

      results.push(entry);
    }

    // Sort by most recent first
    results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    // Apply pagination
    if (query.offset) {
      results = results.slice(query.offset);
    }
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Get memory statistics for a tenant.
   */
  async getStats(context: TenantContext, agentId?: string): Promise<MemoryStats> {
    const entries = await this.query(context, { agentId });

    const byType: Record<MemoryType, number> = {
      episodic: 0,
      semantic: 0,
      procedural: 0,
      working: 0,
    };

    let totalSizeBytes = 0;
    let oldestEntry: string | undefined;
    let newestEntry: string | undefined;

    for (const entry of entries) {
      byType[entry.type]++;
      totalSizeBytes += entry.metadata.sizeBytes;

      if (!oldestEntry || entry.createdAt < oldestEntry) {
        oldestEntry = entry.createdAt;
      }
      if (!newestEntry || entry.createdAt > newestEntry) {
        newestEntry = entry.createdAt;
      }
    }

    return {
      totalEntries: entries.length,
      byType,
      totalSizeBytes,
      oldestEntry,
      newestEntry,
    };
  }

  // ─── Bulk Operations ─────────────────────────────────────────

  /**
   * Export all memory for a tenant (for backup/migration).
   */
  async exportTenantMemory(context: TenantContext): Promise<MemoryEntry[]> {
    return this.query(context, {});
  }

  /**
   * Import memory entries for a tenant (for restore/migration).
   */
  async importTenantMemory(context: TenantContext, entries: MemoryEntry[]): Promise<number> {
    let imported = 0;
    for (const entry of entries) {
      // Override tenant to ensure isolation
      const compositeKey = this.buildKey(context.tenantId, entry.agentId, entry.key);
      const newEntry: MemoryEntry = {
        ...entry,
        tenantId: context.tenantId,
        workspaceId: context.workspaceId,
      };
      this.store.set(compositeKey, newEntry);
      this.indexEntry(newEntry);
      imported++;
    }
    return imported;
  }

  /**
   * Cleanup expired entries across all tenants.
   */
  async cleanupExpired(): Promise<number> {
    const now = new Date();
    let cleaned = 0;

    for (const [key, entry] of this.store) {
      if (entry.expiresAt && new Date(entry.expiresAt) < now) {
        this.store.delete(key);
        this.removeFromIndex(entry);
        cleaned++;
      }
    }

    return cleaned;
  }

  // ─── Private ─────────────────────────────────────────────────

  private buildKey(tenantId: string, agentId: string, key: string): string {
    return `${tenantId}:${agentId}:${key}`;
  }

  private indexEntry(entry: MemoryEntry): void {
    // Tenant index
    if (!this.tenantIndex.has(entry.tenantId)) {
      this.tenantIndex.set(entry.tenantId, new Set());
    }
    this.tenantIndex.get(entry.tenantId)!.add(
      this.buildKey(entry.tenantId, entry.agentId, entry.key)
    );

    // Agent index
    const agentKey = `${entry.tenantId}:${entry.agentId}`;
    if (!this.agentIndex.has(agentKey)) {
      this.agentIndex.set(agentKey, new Set());
    }
    this.agentIndex.get(agentKey)!.add(
      this.buildKey(entry.tenantId, entry.agentId, entry.key)
    );
  }

  private removeFromIndex(entry: MemoryEntry): void {
    const compositeKey = this.buildKey(entry.tenantId, entry.agentId, entry.key);
    this.tenantIndex.get(entry.tenantId)?.delete(compositeKey);
    const agentKey = `${entry.tenantId}:${entry.agentId}`;
    this.agentIndex.get(agentKey)?.delete(compositeKey);
  }

  private estimateSize(value: unknown): number {
    try {
      return JSON.stringify(value).length * 2; // UTF-16 approximation
    } catch {
      return 0;
    }
  }

  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /** Reset all state (for testing) */
  reset(): void {
    this.store.clear();
    this.tenantIndex.clear();
    this.agentIndex.clear();
  }

  /** Get total entry count (for monitoring) */
  getTotalEntries(): number {
    return this.store.size;
  }
}

// ─────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────

export class MemoryIsolationError extends Error {
  constructor(public requestingTenant: string, public owningTenant: string) {
    super(`Memory isolation violation: tenant ${requestingTenant} attempted to access memory owned by ${owningTenant}`);
    this.name = "MemoryIsolationError";
  }
}

export class MemoryQuotaExceededError extends Error {
  constructor(public tenantId: string, public quotaBytes: number, public currentBytes: number) {
    super(`Memory quota exceeded for tenant ${tenantId}: ${currentBytes}/${quotaBytes} bytes`);
    this.name = "MemoryQuotaExceededError";
  }
}

// ─────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────

export function createTenantMemoryStore(): TenantAwareMemoryStore {
  return new TenantAwareMemoryStore();
}
