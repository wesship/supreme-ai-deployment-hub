/**
 * D3VONN Enterprise Governance — Audit Explorer
 *
 * Comprehensive audit trail with immutable logging, search,
 * filtering, export, and retention policies.
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type AuditCategory = "auth" | "data" | "config" | "billing" | "agent" | "workflow" | "security" | "compliance" | "admin";
export type AuditSeverity = "info" | "warning" | "critical";

export interface AuditEntry {
  id: string;
  tenantId: string;
  userId: string;
  category: AuditCategory;
  severity: AuditSeverity;
  action: string;
  resource: string;
  resourceId: string;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  hash: string; // SHA-256 chain hash for immutability
  previousHash: string;
}

export interface AuditFilter {
  tenantId?: string;
  userId?: string;
  category?: AuditCategory;
  severity?: AuditSeverity;
  action?: string;
  resource?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AuditRetentionPolicy {
  tenantId: string;
  retentionDays: number;
  archiveAfterDays: number;
  complianceHold: boolean;
  encryptArchive: boolean;
}

export interface AuditExport {
  format: "json" | "csv" | "pdf";
  entries: AuditEntry[];
  generatedAt: string;
  filters: AuditFilter;
  totalCount: number;
}

export interface AuditStats {
  totalEntries: number;
  entriesByCategory: Record<AuditCategory, number>;
  entriesBySeverity: Record<AuditSeverity, number>;
  recentActivity: AuditEntry[];
  topUsers: { userId: string; count: number }[];
  anomalies: AuditAnomaly[];
}

export interface AuditAnomaly {
  type: "unusual_time" | "bulk_operation" | "privilege_escalation" | "geo_anomaly" | "rate_spike";
  description: string;
  entries: string[];
  severity: AuditSeverity;
  detectedAt: string;
}

// ─────────────────────────────────────────────────────────────────
// Audit Explorer
// ─────────────────────────────────────────────────────────────────

export class AuditExplorer {
  private entries: AuditEntry[] = [];
  private retentionPolicies: Map<string, AuditRetentionPolicy> = new Map();
  private lastHash = "0000000000000000000000000000000000000000000000000000000000000000";

  // ─── Logging ────────────────────────────────────────────────

  log(entry: Omit<AuditEntry, "id" | "timestamp" | "hash" | "previousHash">): AuditEntry {
    const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();
    const previousHash = this.lastHash;
    const hash = this.computeHash(id, timestamp, entry.action, previousHash);

    const fullEntry: AuditEntry = {
      ...entry,
      id,
      timestamp,
      hash,
      previousHash,
    };

    this.lastHash = hash;
    this.entries.push(fullEntry);
    return fullEntry;
  }

  private computeHash(id: string, timestamp: string, action: string, previousHash: string): string {
    // Simplified hash for demonstration — production uses crypto.subtle
    const input = `${id}:${timestamp}:${action}:${previousHash}`;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(64, "0");
  }

  // ─── Querying ───────────────────────────────────────────────

  query(filter: AuditFilter): AuditEntry[] {
    let results = [...this.entries];

    if (filter.tenantId) results = results.filter((e) => e.tenantId === filter.tenantId);
    if (filter.userId) results = results.filter((e) => e.userId === filter.userId);
    if (filter.category) results = results.filter((e) => e.category === filter.category);
    if (filter.severity) results = results.filter((e) => e.severity === filter.severity);
    if (filter.action) results = results.filter((e) => e.action === filter.action);
    if (filter.resource) results = results.filter((e) => e.resource === filter.resource);
    if (filter.startDate) results = results.filter((e) => e.timestamp >= filter.startDate!);
    if (filter.endDate) results = results.filter((e) => e.timestamp <= filter.endDate!);
    if (filter.search) {
      const term = filter.search.toLowerCase();
      results = results.filter((e) =>
        e.action.toLowerCase().includes(term) ||
        e.resource.toLowerCase().includes(term) ||
        JSON.stringify(e.details).toLowerCase().includes(term)
      );
    }

    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 100;
    return results.slice(offset, offset + limit);
  }

  // ─── Export ─────────────────────────────────────────────────

  export(filter: AuditFilter, format: "json" | "csv" | "pdf" = "json"): AuditExport {
    const entries = this.query(filter);
    return {
      format,
      entries,
      generatedAt: new Date().toISOString(),
      filters: filter,
      totalCount: entries.length,
    };
  }

  // ─── Retention ──────────────────────────────────────────────

  setRetentionPolicy(policy: AuditRetentionPolicy): void {
    this.retentionPolicies.set(policy.tenantId, policy);
  }

  getRetentionPolicy(tenantId: string): AuditRetentionPolicy | undefined {
    return this.retentionPolicies.get(tenantId);
  }

  enforceRetention(): { archived: number; deleted: number } {
    let archived = 0;
    let deleted = 0;
    const now = Date.now();

    for (const [tenantId, policy] of this.retentionPolicies) {
      if (policy.complianceHold) continue;

      const archiveThreshold = now - policy.archiveAfterDays * 86400000;
      const deleteThreshold = now - policy.retentionDays * 86400000;

      this.entries = this.entries.filter((e) => {
        if (e.tenantId !== tenantId) return true;
        const entryTime = new Date(e.timestamp).getTime();
        if (entryTime < deleteThreshold) { deleted++; return false; }
        if (entryTime < archiveThreshold) { archived++; }
        return true;
      });
    }

    return { archived, deleted };
  }

  // ─── Integrity Verification ─────────────────────────────────

  verifyIntegrity(): { valid: boolean; brokenAt?: number } {
    for (let i = 1; i < this.entries.length; i++) {
      if (this.entries[i].previousHash !== this.entries[i - 1].hash) {
        return { valid: false, brokenAt: i };
      }
    }
    return { valid: true };
  }

  // ─── Statistics ─────────────────────────────────────────────

  getStats(tenantId?: string): AuditStats {
    let entries = tenantId ? this.entries.filter((e) => e.tenantId === tenantId) : this.entries;

    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const userCounts: Record<string, number> = {};

    for (const entry of entries) {
      byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
      bySeverity[entry.severity] = (bySeverity[entry.severity] ?? 0) + 1;
      userCounts[entry.userId] = (userCounts[entry.userId] ?? 0) + 1;
    }

    const topUsers = Object.entries(userCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([userId, count]) => ({ userId, count }));

    return {
      totalEntries: entries.length,
      entriesByCategory: byCategory as Record<AuditCategory, number>,
      entriesBySeverity: bySeverity as Record<AuditSeverity, number>,
      recentActivity: entries.slice(-10),
      topUsers,
      anomalies: this.detectAnomalies(entries),
    };
  }

  private detectAnomalies(entries: AuditEntry[]): AuditAnomaly[] {
    const anomalies: AuditAnomaly[] = [];

    // Detect bulk operations (>50 actions by same user in 1 minute)
    const userMinuteBuckets: Record<string, AuditEntry[]> = {};
    for (const entry of entries) {
      const minute = entry.timestamp.slice(0, 16);
      const key = `${entry.userId}:${minute}`;
      if (!userMinuteBuckets[key]) userMinuteBuckets[key] = [];
      userMinuteBuckets[key].push(entry);
    }

    for (const [key, bucket] of Object.entries(userMinuteBuckets)) {
      if (bucket.length > 50) {
        anomalies.push({
          type: "bulk_operation",
          description: `User ${key.split(":")[0]} performed ${bucket.length} actions in one minute`,
          entries: bucket.map((e) => e.id),
          severity: "warning",
          detectedAt: new Date().toISOString(),
        });
      }
    }

    // Detect privilege escalation
    const escalations = entries.filter((e) => e.action.includes("role_change") || e.action.includes("permission_grant"));
    if (escalations.length > 5) {
      anomalies.push({
        type: "privilege_escalation",
        description: `${escalations.length} privilege changes detected`,
        entries: escalations.map((e) => e.id),
        severity: "critical",
        detectedAt: new Date().toISOString(),
      });
    }

    return anomalies;
  }
}

export function createAuditExplorer(): AuditExplorer {
  return new AuditExplorer();
}
