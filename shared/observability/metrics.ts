/**
 * D3VONN Metrics Collection
 *
 * Production metrics with:
 * - Counter, gauge, histogram metric types
 * - Tenant/agent/workflow dimensions
 * - Event bus throughput tracking
 * - Agent health metrics
 * - Workflow failure rates
 * - DLQ depth monitoring
 * - RBAC denial tracking
 *
 * @module shared/observability/metrics
 * @version 1.0.0
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type MetricType = "counter" | "gauge" | "histogram";

export interface MetricLabels {
  tenantId?: string;
  workspaceId?: string;
  agentId?: string;
  eventType?: string;
  workflow?: string;
  status?: string;
  method?: string;
  route?: string;
  [key: string]: string | undefined;
}

export interface MetricPoint {
  name: string;
  type: MetricType;
  value: number;
  labels: MetricLabels;
  timestamp: string;
}

export interface HistogramBucket {
  le: number;
  count: number;
}

export interface MetricDefinition {
  name: string;
  type: MetricType;
  help: string;
  buckets?: number[];
}

export interface MetricsSnapshot {
  timestamp: string;
  metrics: MetricPoint[];
  histograms: Record<string, { buckets: HistogramBucket[]; sum: number; count: number }>;
}

// ─────────────────────────────────────────────────────────────────
// Metric Implementations
// ─────────────────────────────────────────────────────────────────

export class Counter {
  readonly name: string;
  readonly help: string;
  private values: Map<string, number> = new Map();

  constructor(name: string, help: string) {
    this.name = name;
    this.help = help;
  }

  inc(labels: MetricLabels = {}, value = 1): void {
    const key = this.labelsKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + value);
  }

  get(labels: MetricLabels = {}): number {
    return this.values.get(this.labelsKey(labels)) ?? 0;
  }

  reset(): void {
    this.values.clear();
  }

  getAll(): Array<{ labels: MetricLabels; value: number }> {
    return Array.from(this.values.entries()).map(([key, value]) => ({
      labels: this.parseKey(key),
      value,
    }));
  }

  private labelsKey(labels: MetricLabels): string {
    return Object.entries(labels)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(",");
  }

  private parseKey(key: string): MetricLabels {
    if (!key) return {};
    const labels: MetricLabels = {};
    for (const part of key.split(",")) {
      const [k, v] = part.split("=");
      labels[k] = v;
    }
    return labels;
  }
}

export class Gauge {
  readonly name: string;
  readonly help: string;
  private values: Map<string, number> = new Map();

  constructor(name: string, help: string) {
    this.name = name;
    this.help = help;
  }

  set(value: number, labels: MetricLabels = {}): void {
    this.values.set(this.labelsKey(labels), value);
  }

  inc(labels: MetricLabels = {}, value = 1): void {
    const key = this.labelsKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + value);
  }

  dec(labels: MetricLabels = {}, value = 1): void {
    const key = this.labelsKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) - value);
  }

  get(labels: MetricLabels = {}): number {
    return this.values.get(this.labelsKey(labels)) ?? 0;
  }

  reset(): void {
    this.values.clear();
  }

  private labelsKey(labels: MetricLabels): string {
    return Object.entries(labels)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(",");
  }
}

export class Histogram {
  readonly name: string;
  readonly help: string;
  private buckets: number[];
  private counts: Map<string, number[]> = new Map();
  private sums: Map<string, number> = new Map();
  private totals: Map<string, number> = new Map();

  constructor(name: string, help: string, buckets?: number[]) {
    this.name = name;
    this.help = help;
    this.buckets = buckets ?? [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
  }

  observe(value: number, labels: MetricLabels = {}): void {
    const key = this.labelsKey(labels);

    if (!this.counts.has(key)) {
      this.counts.set(key, new Array(this.buckets.length).fill(0));
    }

    const counts = this.counts.get(key)!;
    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= this.buckets[i]) {
        counts[i]++;
      }
    }

    this.sums.set(key, (this.sums.get(key) ?? 0) + value);
    this.totals.set(key, (this.totals.get(key) ?? 0) + 1);
  }

  getSnapshot(labels: MetricLabels = {}): { buckets: HistogramBucket[]; sum: number; count: number } {
    const key = this.labelsKey(labels);
    const counts = this.counts.get(key) ?? new Array(this.buckets.length).fill(0);

    return {
      buckets: this.buckets.map((le, i) => ({ le, count: counts[i] })),
      sum: this.sums.get(key) ?? 0,
      count: this.totals.get(key) ?? 0,
    };
  }

  reset(): void {
    this.counts.clear();
    this.sums.clear();
    this.totals.clear();
  }

  private labelsKey(labels: MetricLabels): string {
    return Object.entries(labels)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(",");
  }
}

// ─────────────────────────────────────────────────────────────────
// Metrics Registry
// ─────────────────────────────────────────────────────────────────

export class MetricsRegistry {
  private counters: Map<string, Counter> = new Map();
  private gauges: Map<string, Gauge> = new Map();
  private histograms: Map<string, Histogram> = new Map();

  counter(name: string, help: string): Counter {
    if (!this.counters.has(name)) {
      this.counters.set(name, new Counter(name, help));
    }
    return this.counters.get(name)!;
  }

  gauge(name: string, help: string): Gauge {
    if (!this.gauges.has(name)) {
      this.gauges.set(name, new Gauge(name, help));
    }
    return this.gauges.get(name)!;
  }

  histogram(name: string, help: string, buckets?: number[]): Histogram {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, new Histogram(name, help, buckets));
    }
    return this.histograms.get(name)!;
  }

  snapshot(): MetricsSnapshot {
    const metrics: MetricPoint[] = [];

    for (const counter of this.counters.values()) {
      for (const { labels, value } of counter.getAll()) {
        metrics.push({
          name: counter.name,
          type: "counter",
          value,
          labels,
          timestamp: new Date().toISOString(),
        });
      }
    }

    const histograms: Record<string, { buckets: HistogramBucket[]; sum: number; count: number }> = {};
    for (const [name, histogram] of this.histograms.entries()) {
      histograms[name] = histogram.getSnapshot();
    }

    return {
      timestamp: new Date().toISOString(),
      metrics,
      histograms,
    };
  }

  reset(): void {
    this.counters.forEach((c) => c.reset());
    this.gauges.forEach((g) => g.reset());
    this.histograms.forEach((h) => h.reset());
  }
}

// ─────────────────────────────────────────────────────────────────
// Platform Metrics (Pre-defined)
// ─────────────────────────────────────────────────────────────────

export interface PlatformMetrics {
  // Event Bus
  eventsPublished: Counter;
  eventsDelivered: Counter;
  eventsFailed: Counter;
  eventsDLQ: Counter;
  eventsReplayed: Counter;
  eventLatency: Histogram;

  // Agents
  agentInvocations: Counter;
  agentErrors: Counter;
  agentActiveCount: Gauge;
  agentResponseTime: Histogram;
  agentHealthScore: Gauge;

  // Workflows
  workflowsStarted: Counter;
  workflowsCompleted: Counter;
  workflowsFailed: Counter;
  workflowDuration: Histogram;

  // RBAC
  rbacAllowed: Counter;
  rbacDenied: Counter;
  rbacEscalated: Counter;

  // HTTP
  httpRequests: Counter;
  httpLatency: Histogram;
  httpErrors: Counter;

  // System
  memoryUsage: Gauge;
  cpuUsage: Gauge;
  activeConnections: Gauge;
  uptime: Gauge;
}

export function createPlatformMetrics(registry: MetricsRegistry): PlatformMetrics {
  return {
    // Event Bus
    eventsPublished: registry.counter("d3vonn_events_published_total", "Total events published"),
    eventsDelivered: registry.counter("d3vonn_events_delivered_total", "Total events delivered"),
    eventsFailed: registry.counter("d3vonn_events_failed_total", "Total events that failed delivery"),
    eventsDLQ: registry.counter("d3vonn_events_dlq_total", "Total events sent to DLQ"),
    eventsReplayed: registry.counter("d3vonn_events_replayed_total", "Total events replayed"),
    eventLatency: registry.histogram("d3vonn_event_latency_ms", "Event delivery latency in ms", [1, 5, 10, 25, 50, 100, 250, 500]),

    // Agents
    agentInvocations: registry.counter("d3vonn_agent_invocations_total", "Total agent invocations"),
    agentErrors: registry.counter("d3vonn_agent_errors_total", "Total agent errors"),
    agentActiveCount: registry.gauge("d3vonn_agent_active_count", "Number of active agents"),
    agentResponseTime: registry.histogram("d3vonn_agent_response_time_ms", "Agent response time in ms", [10, 50, 100, 500, 1000, 5000, 10000]),
    agentHealthScore: registry.gauge("d3vonn_agent_health_score", "Agent health score (0-1)"),

    // Workflows
    workflowsStarted: registry.counter("d3vonn_workflows_started_total", "Total workflows started"),
    workflowsCompleted: registry.counter("d3vonn_workflows_completed_total", "Total workflows completed"),
    workflowsFailed: registry.counter("d3vonn_workflows_failed_total", "Total workflows failed"),
    workflowDuration: registry.histogram("d3vonn_workflow_duration_ms", "Workflow duration in ms", [100, 500, 1000, 5000, 10000, 30000, 60000]),

    // RBAC
    rbacAllowed: registry.counter("d3vonn_rbac_allowed_total", "Total RBAC allow decisions"),
    rbacDenied: registry.counter("d3vonn_rbac_denied_total", "Total RBAC deny decisions"),
    rbacEscalated: registry.counter("d3vonn_rbac_escalated_total", "Total RBAC escalations"),

    // HTTP
    httpRequests: registry.counter("d3vonn_http_requests_total", "Total HTTP requests"),
    httpLatency: registry.histogram("d3vonn_http_latency_ms", "HTTP request latency in ms", [5, 10, 25, 50, 100, 250, 500, 1000]),
    httpErrors: registry.counter("d3vonn_http_errors_total", "Total HTTP errors"),

    // System
    memoryUsage: registry.gauge("d3vonn_memory_usage_bytes", "Memory usage in bytes"),
    cpuUsage: registry.gauge("d3vonn_cpu_usage_percent", "CPU usage percentage"),
    activeConnections: registry.gauge("d3vonn_active_connections", "Active connections"),
    uptime: registry.gauge("d3vonn_uptime_seconds", "System uptime in seconds"),
  };
}

// ─────────────────────────────────────────────────────────────────
// Singleton
// ─────────────────────────────────────────────────────────────────

let globalRegistry: MetricsRegistry | null = null;
let globalMetrics: PlatformMetrics | null = null;

export function getMetricsRegistry(): MetricsRegistry {
  if (!globalRegistry) {
    globalRegistry = new MetricsRegistry();
  }
  return globalRegistry;
}

export function getPlatformMetrics(): PlatformMetrics {
  if (!globalMetrics) {
    globalMetrics = createPlatformMetrics(getMetricsRegistry());
  }
  return globalMetrics;
}
