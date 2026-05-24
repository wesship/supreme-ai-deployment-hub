/**
 * Multi-Tenant API Layer — Usage Metering and Rate Limiting
 *
 * Tracks per-tenant usage events and enforces rate limits using a
 * sliding window algorithm. In production, this would be backed by Redis.
 */

import {
  Tenant,
  UsageEvent,
  UsageEventType,
  UsageSummary,
  RateLimitState,
  RateLimitResult,
} from "./types.js";

// ── Rate Limiter ──────────────────────────────────────────────────────────────

export class RateLimiter {
  // Per-tenant sliding window state: tenantId -> { minute: count, day: count, windowStart }
  private minuteWindows: Map<string, { count: number; windowStart: number }> = new Map();
  private dayWindows: Map<string, { count: number; windowStart: number }> = new Map();

  checkAndConsume(tenant: Tenant): RateLimitResult {
    const now = Date.now();
    const minuteMs = 60_000;
    const dayMs = 86_400_000;

    // Per-minute window
    const minuteState = this.minuteWindows.get(tenant.id) ?? { count: 0, windowStart: now };
    if (now - minuteState.windowStart > minuteMs) {
      minuteState.count = 0;
      minuteState.windowStart = now;
    }

    // Per-day window
    const dayState = this.dayWindows.get(tenant.id) ?? { count: 0, windowStart: now };
    if (now - dayState.windowStart > dayMs) {
      dayState.count = 0;
      dayState.windowStart = now;
    }

    const minuteLimit = tenant.quotas.requestsPerMinute;
    const dayLimit = tenant.quotas.requestsPerDay;

    if (minuteState.count >= minuteLimit) {
      const resetAt = new Date(minuteState.windowStart + minuteMs);
      const retryAfterMs = resetAt.getTime() - now;
      return { allowed: false, remaining: 0, resetAt, retryAfterMs };
    }

    if (dayState.count >= dayLimit) {
      const resetAt = new Date(dayState.windowStart + dayMs);
      const retryAfterMs = resetAt.getTime() - now;
      return { allowed: false, remaining: 0, resetAt, retryAfterMs };
    }

    // Consume
    minuteState.count++;
    dayState.count++;
    this.minuteWindows.set(tenant.id, minuteState);
    this.dayWindows.set(tenant.id, dayState);

    const remaining = Math.min(minuteLimit - minuteState.count, dayLimit - dayState.count);
    const resetAt = new Date(minuteState.windowStart + minuteMs);

    return { allowed: true, remaining, resetAt };
  }

  getRateLimitState(tenantId: string): RateLimitState {
    const now = Date.now();
    const minuteState = this.minuteWindows.get(tenantId) ?? { count: 0, windowStart: now };
    const isThrottled = false; // Would check against quota in real impl
    return {
      tenantId,
      windowStart: new Date(minuteState.windowStart),
      requestCount: minuteState.count,
      tokenCount: 0,
      isThrottled,
    };
  }

  reset(tenantId: string): void {
    this.minuteWindows.delete(tenantId);
    this.dayWindows.delete(tenantId);
  }
}

// ── Usage Meter ───────────────────────────────────────────────────────────────

export class UsageMeter {
  private events: UsageEvent[] = [];
  private readonly maxEvents = 100_000; // Rolling buffer

  record(event: Omit<UsageEvent, "id">): UsageEvent {
    const fullEvent: UsageEvent = {
      ...event,
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };

    this.events.push(fullEvent);

    // Trim buffer if needed
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    return fullEvent;
  }

  getSummary(tenantId: string, periodStart: Date, periodEnd: Date): UsageSummary {
    const tenantEvents = this.events.filter(
      (e) =>
        e.tenantId === tenantId &&
        e.timestamp >= periodStart &&
        e.timestamp <= periodEnd
    );

    const byEventType = {} as Record<UsageEventType, number>;
    const eventTypes: UsageEventType[] = [
      "agent_execution",
      "prediction_request",
      "governance_decision",
      "memory_read",
      "memory_write",
      "tool_call",
    ];
    for (const t of eventTypes) byEventType[t] = 0;

    let totalTokens = 0;
    let totalDurationMs = 0;

    for (const event of tenantEvents) {
      byEventType[event.eventType] = (byEventType[event.eventType] ?? 0) + 1;
      totalTokens += event.tokensConsumed;
      totalDurationMs += event.durationMs;
    }

    return {
      tenantId,
      periodStart,
      periodEnd,
      totalRequests: tenantEvents.length,
      totalTokens,
      totalDurationMs,
      byEventType,
      quotaUtilization: {
        requestsPerDay: 0, // Would compute against quota in real impl
        requestsPerMinute: 0,
        storageGb: 0,
      },
    };
  }

  getRecentEvents(tenantId: string, limit = 100): UsageEvent[] {
    return this.events
      .filter((e) => e.tenantId === tenantId)
      .slice(-limit)
      .reverse();
  }

  getTotalEventCount(tenantId: string): number {
    return this.events.filter((e) => e.tenantId === tenantId).length;
  }

  clearTenantData(tenantId: string): void {
    this.events = this.events.filter((e) => e.tenantId !== tenantId);
  }
}
