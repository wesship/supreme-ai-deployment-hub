/**
 * D3VONN Observability Module
 *
 * Unified production observability layer providing:
 * - Structured JSON logging with tenant context
 * - Metrics collection (counters, gauges, histograms)
 * - Sentry error tracking and performance monitoring
 * - Health check system with component monitoring
 * - Alert management with escalation and routing
 *
 * @module shared/observability
 * @version 1.0.0
 */

// Logger
export {
  D3VONNLogger,
  ConsoleTransport,
  InMemoryTransport,
  BatchTransport,
  createLogger,
  type LogLevel,
  type LogContext,
  type LogEntry,
  type LogTransport,
  type LoggerConfig,
} from "./logger";

// Metrics
export {
  Counter,
  Gauge,
  Histogram,
  MetricsRegistry,
  createPlatformMetrics,
  getMetricsRegistry,
  getPlatformMetrics,
  type MetricType,
  type MetricLabels,
  type MetricPoint,
  type HistogramBucket,
  type MetricDefinition,
  type MetricsSnapshot,
  type PlatformMetrics,
} from "./metrics";

// Sentry
export {
  D3VONNSentry,
  initSentry,
  getSentry,
  SENTRY_FRONTEND_CONFIG,
  SENTRY_BACKEND_CONFIG,
  type SentryConfig,
  type SentryEvent,
  type SentryBreadcrumb,
  type SentryTransaction,
  type SentrySpan,
} from "./sentry";

// Health
export {
  HealthCheckRegistry,
  createHealthCheckRegistry,
  createDatabaseHealthCheck,
  createEventBusHealthCheck,
  createAgentMeshHealthCheck,
  createCacheHealthCheck,
  createExternalAPIHealthCheck,
  createMemoryHealthCheck,
  type HealthStatus,
  type HealthCheck,
  type SystemHealth,
  type HealthCheckFn,
  type HealthHistoryEntry,
} from "./health";

// Alerts
export {
  AlertManager,
  createAlertManager,
  DEFAULT_ALERT_RULES,
  type AlertSeverity,
  type AlertStatus,
  type AlertChannel,
  type AlertRule,
  type AlertCondition,
  type Alert,
  type AlertNotification,
} from "./alerts";

// ─────────────────────────────────────────────────────────────────
// Unified Observability Bootstrap
// ─────────────────────────────────────────────────────────────────

import { createLogger, InMemoryTransport, ConsoleTransport } from "./logger";
import { getMetricsRegistry, getPlatformMetrics } from "./metrics";
import { initSentry } from "./sentry";
import { createHealthCheckRegistry } from "./health";
import { createAlertManager } from "./alerts";

export interface ObservabilityStack {
  logger: ReturnType<typeof createLogger>;
  metrics: ReturnType<typeof getPlatformMetrics>;
  registry: ReturnType<typeof getMetricsRegistry>;
  sentry: ReturnType<typeof initSentry>;
  health: ReturnType<typeof createHealthCheckRegistry>;
  alerts: ReturnType<typeof createAlertManager>;
}

export function bootstrapObservability(options?: {
  environment?: string;
  sentryDsn?: string;
  logLevel?: "debug" | "info" | "warn" | "error" | "fatal";
}): ObservabilityStack {
  const memoryTransport = new InMemoryTransport({ maxSize: 5000 });
  const consoleTransport = new ConsoleTransport({ pretty: options?.environment !== "production" });

  const logger = createLogger({
    service: "d3vonn-platform",
    environment: options?.environment ?? "development",
    level: options?.logLevel ?? "info",
    transports: [consoleTransport, memoryTransport],
  });

  const registry = getMetricsRegistry();
  const metrics = getPlatformMetrics();

  const sentry = initSentry({
    dsn: options?.sentryDsn ?? "",
    environment: options?.environment ?? "development",
  });

  const health = createHealthCheckRegistry();
  const alerts = createAlertManager();

  logger.info("Observability stack initialized", undefined, {
    environment: options?.environment ?? "development",
    sentryEnabled: !!options?.sentryDsn,
    healthChecks: health.getRegisteredChecks().length,
    alertRules: alerts.getRules().length,
  });

  return { logger, metrics, registry, sentry, health, alerts };
}
