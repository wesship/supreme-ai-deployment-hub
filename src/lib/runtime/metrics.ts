/**
 * Devonn.AI — Runtime Metrics Module
 *
 * Lightweight in-process counter/gauge registry.
 * Exposes a /metrics endpoint payload and a Prometheus-compatible
 * text format for scraping.
 */

import { z } from "zod";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MetricType = "counter" | "gauge";

export interface MetricSnapshot {
  name: string;
  type: MetricType;
  value: number;
  labels: Record<string, string>;
  description: string;
  updated_at: string;
}

export const MetricsResponseSchema = z.object({
  timestamp: z.string().datetime(),
  metrics: z.array(
    z.object({
      name: z.string(),
      type: z.enum(["counter", "gauge"]),
      value: z.number(),
      labels: z.record(z.string()),
      description: z.string(),
      updated_at: z.string().datetime(),
    }),
  ),
});

export type MetricsResponse = z.infer<typeof MetricsResponseSchema>;

// ── Metrics Registry ──────────────────────────────────────────────────────────

export class MetricsRegistry {
  private counters = new Map<string, { value: number; description: string; labels: Record<string, string>; updated_at: string }>();
  private gauges = new Map<string, { value: number; description: string; labels: Record<string, string>; updated_at: string }>();

  /** Increment a counter by delta (default 1). */
  increment(name: string, delta = 1, labels: Record<string, string> = {}): void {
    const existing = this.counters.get(name);
    this.counters.set(name, {
      value: (existing?.value ?? 0) + delta,
      description: existing?.description ?? name,
      labels: { ...existing?.labels, ...labels },
      updated_at: new Date().toISOString(),
    });
  }

  /** Set a gauge to an absolute value. */
  setGauge(name: string, value: number, description = "", labels: Record<string, string> = {}): void {
    this.gauges.set(name, { value, description, labels, updated_at: new Date().toISOString() });
  }

  /** Register a counter with a description (idempotent). */
  registerCounter(name: string, description: string): void {
    if (!this.counters.has(name)) {
      this.counters.set(name, { value: 0, description, labels: {}, updated_at: new Date().toISOString() });
    }
  }

  /** Get the current value of a counter. */
  getCounter(name: string): number {
    return this.counters.get(name)?.value ?? 0;
  }

  /** Get the current value of a gauge. */
  getGauge(name: string): number {
    return this.gauges.get(name)?.value ?? 0;
  }

  /** Reset a counter to zero. */
  resetCounter(name: string): void {
    const existing = this.counters.get(name);
    if (existing) {
      this.counters.set(name, { ...existing, value: 0, updated_at: new Date().toISOString() });
    }
  }

  /** Snapshot all metrics as a structured response. */
  snapshot(): MetricsResponse {
    const metrics: MetricSnapshot[] = [];

    for (const [name, m] of this.counters) {
      metrics.push({ name, type: "counter", value: m.value, labels: m.labels, description: m.description, updated_at: m.updated_at });
    }
    for (const [name, m] of this.gauges) {
      metrics.push({ name, type: "gauge", value: m.value, labels: m.labels, description: m.description, updated_at: m.updated_at });
    }

    return { timestamp: new Date().toISOString(), metrics };
  }

  /** Prometheus text format for /metrics scraping. */
  prometheusText(): string {
    const lines: string[] = [];
    const snap = this.snapshot();
    for (const m of snap.metrics) {
      lines.push(`# HELP ${m.name} ${m.description}`);
      lines.push(`# TYPE ${m.name} ${m.type}`);
      const labelStr = Object.entries(m.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(",");
      lines.push(`${m.name}${labelStr ? `{${labelStr}}` : ""} ${m.value}`);
    }
    return lines.join("\n");
  }
}

// ── Canonical Metric Names ────────────────────────────────────────────────────

export const METRIC_NAMES = {
  // Request counters
  REQUEST_TOTAL: "devonn_request_total",
  REQUEST_ERROR_TOTAL: "devonn_request_error_total",
  // Prediction metrics
  PREDICTION_LATENCY_MS: "devonn_prediction_latency_ms",
  PREDICTION_TOTAL: "devonn_prediction_total",
  PREDICTION_ERROR_TOTAL: "devonn_prediction_error_total",
  // Contract validation
  CONTRACT_VALIDATION_FAILURE_TOTAL: "devonn_contract_validation_failure_total",
  CONTRACT_SCHEMA_DRIFT_TOTAL: "devonn_contract_schema_drift_total",
  // Worker / queue
  WORKER_RECOVERY_TOTAL: "devonn_worker_recovery_total",
  QUEUE_DEPTH: "devonn_queue_depth",
  STUCK_JOB_TOTAL: "devonn_stuck_job_total",
  // Governance
  GOVERNANCE_DECISION_TOTAL: "devonn_governance_decision_total",
  GOVERNANCE_DENY_TOTAL: "devonn_governance_deny_total",
} as const;

// ── Default Registry ──────────────────────────────────────────────────────────

export const metricsRegistry = new MetricsRegistry();

// Register all canonical counters with descriptions
metricsRegistry.registerCounter(METRIC_NAMES.REQUEST_TOTAL, "Total HTTP requests received");
metricsRegistry.registerCounter(METRIC_NAMES.REQUEST_ERROR_TOTAL, "Total HTTP request errors");
metricsRegistry.registerCounter(METRIC_NAMES.PREDICTION_TOTAL, "Total prediction requests");
metricsRegistry.registerCounter(METRIC_NAMES.PREDICTION_ERROR_TOTAL, "Total prediction errors");
metricsRegistry.registerCounter(METRIC_NAMES.CONTRACT_VALIDATION_FAILURE_TOTAL, "Total contract schema validation failures");
metricsRegistry.registerCounter(METRIC_NAMES.CONTRACT_SCHEMA_DRIFT_TOTAL, "Total schema drift events detected");
metricsRegistry.registerCounter(METRIC_NAMES.WORKER_RECOVERY_TOTAL, "Total worker recovery events");
metricsRegistry.registerCounter(METRIC_NAMES.STUCK_JOB_TOTAL, "Total stuck jobs detected");
metricsRegistry.registerCounter(METRIC_NAMES.GOVERNANCE_DECISION_TOTAL, "Total governance decisions made");
metricsRegistry.registerCounter(METRIC_NAMES.GOVERNANCE_DENY_TOTAL, "Total governance deny decisions");
metricsRegistry.setGauge(METRIC_NAMES.QUEUE_DEPTH, 0, "Current job queue depth");
metricsRegistry.setGauge(METRIC_NAMES.PREDICTION_LATENCY_MS, 0, "Latest prediction latency in ms");
