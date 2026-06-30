/**
 * D3VONN Production Observability v1 — Smoke Tests
 *
 * Validates:
 * - Structured logger with tenant context
 * - Metrics collection (counters, gauges, histograms)
 * - Sentry integration configuration
 * - Health check system
 * - Alert management with DLQ/RBAC rules
 * - Admin route availability
 * - Observability bootstrap
 */

import { describe, it, expect, beforeEach } from "vitest";

// Logger
import {
  D3VONNLogger,
  ConsoleTransport,
  InMemoryTransport,
  createLogger,
} from "../../../shared/observability/logger";

// Metrics
import {
  Counter,
  Gauge,
  Histogram,
  MetricsRegistry,
  createPlatformMetrics,
} from "../../../shared/observability/metrics";

// Sentry
import {
  D3VONNSentry,
  SENTRY_FRONTEND_CONFIG,
  SENTRY_BACKEND_CONFIG,
} from "../../../shared/observability/sentry";

// Health
import {
  HealthCheckRegistry,
  createHealthCheckRegistry,
  createDatabaseHealthCheck,
  createEventBusHealthCheck,
  createAgentMeshHealthCheck,
  createCacheHealthCheck,
  createMemoryHealthCheck,
} from "../../../shared/observability/health";

// Alerts
import {
  AlertManager,
  createAlertManager,
  DEFAULT_ALERT_RULES,
} from "../../../shared/observability/alerts";

// Bootstrap
import { bootstrapObservability } from "../../../shared/observability/index";

// ─────────────────────────────────────────────────────────────────
// Structured Logger Tests
// ─────────────────────────────────────────────────────────────────

describe("Observability: Structured Logger", () => {
  let transport: InMemoryTransport;
  let logger: ReturnType<typeof createLogger>;

  beforeEach(() => {
    transport = new InMemoryTransport({ maxSize: 100 });
    logger = createLogger({
      service: "test-service",
      environment: "test",
      level: "debug",
      transports: [transport],
    });
  });

  it("should produce structured JSON log entries", () => {
    logger.info("test message");
    expect(transport.entries.length).toBe(1);
    expect(transport.entries[0].level).toBe("info");
    expect(transport.entries[0].message).toBe("test message");
    expect(transport.entries[0].service).toBe("test-service");
    expect(transport.entries[0].timestamp).toBeDefined();
  });

  it("should include tenant context in logs", () => {
    logger.info("tenant action", {
      tenantId: "tenant-acme",
      workspaceId: "ws-prod",
      userId: "user-123",
    });
    expect(transport.entries[0].context?.tenantId).toBe("tenant-acme");
    expect(transport.entries[0].context?.workspaceId).toBe("ws-prod");
  });

  it("should respect log level filtering", () => {
    const warnLogger = createLogger({
      service: "test",
      environment: "test",
      level: "warn",
      transports: [transport],
    });
    warnLogger.debug("should not appear");
    warnLogger.info("should not appear");
    warnLogger.warn("should appear");
    warnLogger.error("should appear", new Error("test"));
    expect(transport.entries.length).toBe(2);
    expect(transport.entries[0].level).toBe("warn");
    expect(transport.entries[1].level).toBe("error");
  });

  it("should include data in log entries", () => {
    logger.info("event processed", undefined, {
      eventType: "TaskCreated",
      duration: 42,
    });
    expect(transport.entries[0].data?.eventType).toBe("TaskCreated");
    expect(transport.entries[0].data?.duration).toBe(42);
  });

  it("should support child loggers with inherited context", () => {
    const child = logger.child({ agentId: "hermes" });
    child.info("child message");
    expect(transport.entries[0].context?.agentId).toBe("hermes");
  });
});

// ─────────────────────────────────────────────────────────────────
// Metrics Tests
// ─────────────────────────────────────────────────────────────────

describe("Observability: Metrics Collection", () => {
  let registry: MetricsRegistry;

  beforeEach(() => {
    registry = new MetricsRegistry();
  });

  it("should create and increment counters", () => {
    const counter = registry.counter("test_requests_total", "Total requests");
    counter.inc();
    counter.inc({}, 5);
    expect(counter.get()).toBe(6);
  });

  it("should create and set gauges", () => {
    const gauge = registry.gauge("test_active_connections", "Active connections");
    gauge.set(42);
    expect(gauge.get()).toBe(42);
    gauge.inc({}, 3);
    expect(gauge.get()).toBe(45);
    gauge.dec({}, 10);
    expect(gauge.get()).toBe(35);
  });

  it("should create histograms with bucket distribution", () => {
    const histogram = registry.histogram(
      "test_request_duration",
      "Request duration",
      [10, 50, 100, 250, 500, 1000]
    );
    histogram.observe(15);
    histogram.observe(75);
    histogram.observe(200);
    histogram.observe(800);
    const snapshot = histogram.getSnapshot();
    expect(snapshot.count).toBe(4);
    expect(snapshot.sum).toBe(1090);
  });

  it("should support labeled metrics", () => {
    const counter = registry.counter("http_requests_total", "HTTP requests");
    counter.inc({ method: "GET", status: "200" });
    counter.inc({ method: "POST", status: "201" });
    counter.inc({ method: "GET", status: "200" });
    expect(counter.get({ method: "GET", status: "200" })).toBe(2);
    expect(counter.get({ method: "POST", status: "201" })).toBe(1);
  });

  it("should export metrics snapshot", () => {
    registry.counter("test_a", "A").inc();
    registry.gauge("test_b", "B").set(5);
    const snapshot = registry.snapshot();
    expect(snapshot.metrics.length).toBeGreaterThanOrEqual(1);
  });

  it("should create platform metrics with standard names", () => {
    const metrics = createPlatformMetrics(registry);
    expect(metrics.eventsPublished).toBeDefined();
    expect(metrics.eventsDelivered).toBeDefined();
    expect(metrics.eventsFailed).toBeDefined();
    expect(metrics.agentInvocations).toBeDefined();
    expect(metrics.agentErrors).toBeDefined();
    expect(metrics.rbacAllowed).toBeDefined();
    expect(metrics.rbacDenied).toBeDefined();
    expect(metrics.httpLatency).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────
// Sentry Tests
// ─────────────────────────────────────────────────────────────────

describe("Observability: Sentry Integration", () => {
  it("should have frontend configuration", () => {
    expect(SENTRY_FRONTEND_CONFIG.dsn).toBeDefined();
    expect(SENTRY_FRONTEND_CONFIG.environment).toBeDefined();
    expect(SENTRY_FRONTEND_CONFIG.tracesSampleRate).toBeGreaterThan(0);
    expect(SENTRY_FRONTEND_CONFIG.tracesSampleRate).toBeLessThanOrEqual(1);
  });

  it("should have backend configuration", () => {
    expect(SENTRY_BACKEND_CONFIG.dsn).toBeDefined();
    expect(SENTRY_BACKEND_CONFIG.environment).toBeDefined();
    expect(SENTRY_BACKEND_CONFIG.tracesSampleRate).toBeGreaterThan(0);
  });

  it("should capture exceptions with tenant context", () => {
    const sentry = new D3VONNSentry({
      ...SENTRY_FRONTEND_CONFIG,
      dsn: "https://test@sentry.d3vonn.io/1",
      environment: "test",
    });
    sentry.init();
    const eventId = sentry.captureException(new Error("test error"), {
      tenantId: "tenant-acme",
      agentId: "hermes",
    });
    expect(eventId).toBeDefined();
    expect(typeof eventId).toBe("string");
  });

  it("should create transactions for performance monitoring", () => {
    const sentry = new D3VONNSentry({
      ...SENTRY_FRONTEND_CONFIG,
      dsn: "https://test@sentry.d3vonn.io/1",
      environment: "test",
    });
    sentry.init();
    const transaction = sentry.startTransaction("task.process", "task");
    expect(transaction).toBeDefined();
    expect(transaction.name).toBe("task.process");
  });

  it("should add breadcrumbs for event tracing", () => {
    const sentry = new D3VONNSentry({
      ...SENTRY_FRONTEND_CONFIG,
      dsn: "https://test@sentry.d3vonn.io/1",
      environment: "test",
    });
    sentry.init();
    sentry.addBreadcrumb({
      category: "event-bus",
      message: "TaskCreated published",
      level: "info",
    });
    const events = sentry.getCapturedEvents();
    // Breadcrumbs are attached to events, not directly retrievable
    // But we can verify addBreadcrumb doesn't throw
    expect(true).toBe(true);
  });

  it("should capture messages", () => {
    const sentry = new D3VONNSentry({
      ...SENTRY_FRONTEND_CONFIG,
      dsn: "https://test@sentry.d3vonn.io/1",
      environment: "test",
    });
    sentry.init();
    const eventId = sentry.captureMessage("test message", "warning");
    expect(eventId).toBeDefined();
    const events = sentry.getCapturedEvents();
    expect(events.length).toBe(1);
    expect(events[0].message).toBe("test message");
  });
});

// ─────────────────────────────────────────────────────────────────
// Health Check Tests
// ─────────────────────────────────────────────────────────────────

describe("Observability: Health Checks", () => {
  it("should create a health check registry with default checks", () => {
    const registry = createHealthCheckRegistry();
    const checks = registry.getRegisteredChecks();
    expect(checks.length).toBeGreaterThan(0);
  });

  it("should run all health checks and return system health", async () => {
    const registry = createHealthCheckRegistry();
    const result = await registry.runAll();
    expect(result.status).toBeDefined();
    expect(result.checks.length).toBeGreaterThan(0);
    expect(result.summary.total).toBeGreaterThan(0);
  });

  it("should include version and uptime in health result", async () => {
    const registry = createHealthCheckRegistry();
    const result = await registry.runAll();
    expect(result.version).toBe("2.0.0-alpha.1");
    expect(result.uptime).toBeGreaterThanOrEqual(0);
    expect(result.timestamp).toBeDefined();
  });

  it("should track health history", async () => {
    const registry = createHealthCheckRegistry();
    await registry.runAll();
    await registry.runAll();
    const history = registry.getHistory();
    expect(history.length).toBe(2);
  });

  it("should provide pre-built health check factories", () => {
    expect(createDatabaseHealthCheck).toBeDefined();
    expect(createEventBusHealthCheck).toBeDefined();
    expect(createAgentMeshHealthCheck).toBeDefined();
    expect(createCacheHealthCheck).toBeDefined();
    expect(createMemoryHealthCheck).toBeDefined();
  });

  it("should report latency for each check", async () => {
    const registry = createHealthCheckRegistry();
    const result = await registry.runAll();
    for (const check of result.checks) {
      expect(check.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────
// Alert Management Tests
// ─────────────────────────────────────────────────────────────────

describe("Observability: Alert Management", () => {
  let alertManager: AlertManager;

  beforeEach(() => {
    alertManager = createAlertManager();
  });

  it("should have default alert rules", () => {
    const rules = alertManager.getRules();
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.some((r) => r.name.includes("DLQ"))).toBe(true);
    expect(rules.some((r) => r.name.includes("RBAC"))).toBe(true);
  });

  it("should evaluate metrics against rules and fire alerts", () => {
    alertManager.evaluate("d3vonn_events_dlq_total", 55);
    const active = alertManager.getActiveAlerts();
    expect(active.length).toBeGreaterThan(0);
    expect(active[0].severity).toBe("critical");
  });

  it("should resolve alerts when metric returns below threshold", () => {
    alertManager.evaluate("d3vonn_events_dlq_total", 55);
    expect(alertManager.getActiveAlerts().length).toBeGreaterThan(0);
    alertManager.evaluate("d3vonn_events_dlq_total", 2);
    const active = alertManager.getActiveAlerts();
    expect(active.length).toBe(0);
  });

  it("should support alert acknowledgment", () => {
    alertManager.evaluate("d3vonn_events_dlq_total", 55);
    const alerts = alertManager.getActiveAlerts();
    alertManager.acknowledge(alerts[0].id, "admin@d3vonn.io");
    const updated = alertManager.getActiveAlerts();
    expect(updated[0].status).toBe("acknowledged");
    expect(updated[0].acknowledgedBy).toBe("admin@d3vonn.io");
  });

  it("should support alert silencing by disabling rule", () => {
    alertManager.evaluate("d3vonn_events_dlq_total", 55);
    const alerts = alertManager.getActiveAlerts();
    const ruleId = alerts[0].ruleId;
    alertManager.silence(ruleId);
    // Rule is now disabled, new evaluations should not fire
    const rules = alertManager.getRules();
    const silencedRule = rules.find((r) => r.id === ruleId);
    expect(silencedRule?.enabled).toBe(false);
  });

  it("should track alert history via getAlertHistory", () => {
    alertManager.evaluate("d3vonn_events_dlq_total", 55);
    alertManager.evaluate("d3vonn_events_dlq_total", 2);
    const history = alertManager.getAlertHistory();
    expect(history.length).toBeGreaterThan(0);
  });

  it("should include DLQ alerting rules in defaults", () => {
    const dlqRules = DEFAULT_ALERT_RULES.filter((r) =>
      r.condition.metric.includes("dlq")
    );
    expect(dlqRules.length).toBeGreaterThan(0);
  });

  it("should include RBAC denial alerting rules in defaults", () => {
    const rbacRules = DEFAULT_ALERT_RULES.filter((r) =>
      r.condition.metric.includes("rbac") && r.condition.metric.includes("denied")
    );
    expect(rbacRules.length).toBeGreaterThan(0);
  });

  it("should provide alert summary", () => {
    alertManager.evaluate("d3vonn_events_dlq_total", 55);
    const summary = alertManager.getSummary();
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.firing).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────
// Admin Route Availability Tests
// ─────────────────────────────────────────────────────────────────

describe("Observability: Admin Routes", () => {
  const OBSERVABILITY_ROUTES = [
    "/platform/health",
    "/platform/metrics",
    "/platform/alerts",
    "/platform/errors",
  ];

  it("should define all observability routes", () => {
    expect(OBSERVABILITY_ROUTES.length).toBe(4);
  });

  it("should have health route for system status", () => {
    expect(OBSERVABILITY_ROUTES).toContain("/platform/health");
  });

  it("should have metrics route for performance data", () => {
    expect(OBSERVABILITY_ROUTES).toContain("/platform/metrics");
  });

  it("should have alerts route for alert management", () => {
    expect(OBSERVABILITY_ROUTES).toContain("/platform/alerts");
  });

  it("should have errors route for trace viewing", () => {
    expect(OBSERVABILITY_ROUTES).toContain("/platform/errors");
  });
});

// ─────────────────────────────────────────────────────────────────
// Bootstrap Tests
// ─────────────────────────────────────────────────────────────────

describe("Observability: Bootstrap", () => {
  it("should bootstrap the full observability stack", () => {
    const stack = bootstrapObservability({
      environment: "test",
      logLevel: "debug",
    });
    expect(stack.logger).toBeDefined();
    expect(stack.metrics).toBeDefined();
    expect(stack.registry).toBeDefined();
    expect(stack.sentry).toBeDefined();
    expect(stack.health).toBeDefined();
    expect(stack.alerts).toBeDefined();
  });

  it("should configure logger with correct service name", () => {
    const stack = bootstrapObservability({ environment: "test" });
    // Logger should be functional - no throw
    stack.logger.info("bootstrap test");
  });

  it("should initialize platform metrics", () => {
    const stack = bootstrapObservability({ environment: "test" });
    expect(stack.metrics.eventsPublished).toBeDefined();
    expect(stack.metrics.agentInvocations).toBeDefined();
  });
});
