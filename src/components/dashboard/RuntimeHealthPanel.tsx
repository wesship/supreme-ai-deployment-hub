/**
 * Devonn.AI — RuntimeHealthPanel
 *
 * Operator dashboard panel showing live runtime health:
 * - API liveness status
 * - Contract validation status
 * - Queue depth / stuck jobs
 * - Last validation failure
 * - Current build SHA
 * - Release gate status
 */

import React, { useEffect, useState, useCallback } from "react";
import type {
  HealthResponse,
  ReadinessResponse,
} from "../../lib/runtime/health.js";
import type { MetricsResponse } from "../../lib/runtime/metrics.js";
import type { VersionResponse } from "../../lib/runtime/version.js";
import type { ReleaseGateResponse } from "../../lib/runtime/releaseGate.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RuntimeHealthData {
  health: HealthResponse | null;
  readiness: ReadinessResponse | null;
  metrics: MetricsResponse | null;
  version: VersionResponse | null;
  releaseGate: ReleaseGateResponse | null;
  lastFetchedAt: string | null;
  error: string | null;
}

export interface RuntimeHealthPanelProps {
  /** Base URL for the runtime API (e.g. https://api.devonn.ai) */
  apiBaseUrl: string;
  /** Poll interval in milliseconds. Default: 30000 */
  pollIntervalMs?: number;
  /** Called when the panel detects a critical health failure */
  onCriticalFailure?: (reason: string) => void;
}

// ── Status Badge ──────────────────────────────────────────────────────────────

type StatusLevel = "ok" | "degraded" | "down" | "unknown";

function StatusBadge({ status }: { status: StatusLevel }) {
  const colors: Record<StatusLevel, string> = {
    ok: "bg-green-100 text-green-800 border-green-200",
    degraded: "bg-yellow-100 text-yellow-800 border-yellow-200",
    down: "bg-red-100 text-red-800 border-red-200",
    unknown: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colors[status]}`}
    >
      {status.toUpperCase()}
    </span>
  );
}

// ── Metric Row ────────────────────────────────────────────────────────────────

function MetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-mono font-medium text-gray-800">{value}</span>
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function RuntimeHealthPanel({
  apiBaseUrl,
  pollIntervalMs = 30_000,
  onCriticalFailure,
}: RuntimeHealthPanelProps) {
  const [data, setData] = useState<RuntimeHealthData>({
    health: null,
    readiness: null,
    metrics: null,
    version: null,
    releaseGate: null,
    lastFetchedAt: null,
    error: null,
  });
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [healthRes, readyRes, metricsRes, versionRes] = await Promise.allSettled([
        fetch(`${apiBaseUrl}/health`).then((r) => r.json()),
        fetch(`${apiBaseUrl}/ready`).then((r) => r.json()),
        fetch(`${apiBaseUrl}/metrics`).then((r) => r.json()),
        fetch(`${apiBaseUrl}/version`).then((r) => r.json()),
      ]);

      const health = healthRes.status === "fulfilled" ? healthRes.value : null;
      const readiness = readyRes.status === "fulfilled" ? readyRes.value : null;
      const metrics = metricsRes.status === "fulfilled" ? metricsRes.value : null;
      const version = versionRes.status === "fulfilled" ? versionRes.value : null;

      if (health?.status === "down" && onCriticalFailure) {
        onCriticalFailure("Runtime health check returned DOWN");
      }
      if (readiness && !readiness.ready && onCriticalFailure) {
        onCriticalFailure("Runtime readiness check failed — required dependencies are down");
      }

      setData({
        health,
        readiness,
        metrics,
        version,
        releaseGate: null,
        lastFetchedAt: new Date().toISOString(),
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown fetch error";
      setData((prev) => ({ ...prev, error: message, lastFetchedAt: new Date().toISOString() }));
      if (onCriticalFailure) onCriticalFailure(message);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, onCriticalFailure]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchAll, pollIntervalMs]);

  // ── Derived values ──────────────────────────────────────────────────────────

  const apiStatus: StatusLevel = data.health?.status ?? "unknown";
  const readyStatus: StatusLevel = data.readiness
    ? data.readiness.ready ? "ok" : "down"
    : "unknown";

  const getMetricValue = (name: string): number => {
    if (!data.metrics) return 0;
    return data.metrics.metrics.find((m) => m.name === name)?.value ?? 0;
  };

  const contractFailures = getMetricValue("devonn_contract_validation_failure_total");
  const queueDepth = getMetricValue("devonn_queue_depth");
  const stuckJobs = getMetricValue("devonn_stuck_job_total");
  const predictionErrors = getMetricValue("devonn_prediction_error_total");
  const predictionTotal = getMetricValue("devonn_prediction_total");
  const errorRate =
    predictionTotal > 0 ? ((predictionErrors / predictionTotal) * 100).toFixed(1) : "0.0";

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 shadow-sm p-4"
      data-testid="runtime-health-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">Runtime Health</h3>
        <div className="flex items-center gap-2">
          {loading && (
            <span className="text-xs text-gray-400 animate-pulse">Refreshing...</span>
          )}
          <StatusBadge status={apiStatus} />
        </div>
      </div>

      {/* Error banner */}
      {data.error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          Fetch error: {data.error}
        </div>
      )}

      {/* Status row */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-gray-50 rounded p-2">
          <div className="text-xs text-gray-500 mb-1">API Liveness</div>
          <StatusBadge status={apiStatus} />
          {data.health && (
            <div className="text-xs text-gray-400 mt-1">
              Uptime: {data.health.uptime_seconds}s
            </div>
          )}
        </div>
        <div className="bg-gray-50 rounded p-2">
          <div className="text-xs text-gray-500 mb-1">Readiness</div>
          <StatusBadge status={readyStatus} />
          {data.readiness && (
            <div className="text-xs text-gray-400 mt-1">
              {data.readiness.dependencies.filter((d) => d.status === "ok").length}/
              {data.readiness.dependencies.length} deps OK
            </div>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="mb-3">
        <div className="text-xs font-medium text-gray-600 mb-1">Metrics</div>
        <MetricRow label="Contract Validation Failures" value={contractFailures} />
        <MetricRow label="Queue Depth" value={queueDepth} />
        <MetricRow label="Stuck Jobs" value={stuckJobs} />
        <MetricRow label="Prediction Error Rate" value={`${errorRate}%`} />
      </div>

      {/* Build info */}
      {data.version && (
        <div className="border-t border-gray-100 pt-2">
          <div className="text-xs text-gray-500 mb-1">Build</div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-gray-600">
              {data.version.build_sha.slice(0, 8)}
            </span>
            <span className="text-xs text-gray-400">{data.version.environment}</span>
          </div>
        </div>
      )}

      {/* Last updated */}
      {data.lastFetchedAt && (
        <div className="mt-2 text-xs text-gray-400 text-right">
          Updated {new Date(data.lastFetchedAt).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

export default RuntimeHealthPanel;
