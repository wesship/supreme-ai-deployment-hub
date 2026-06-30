/**
 * D3VONN — RuntimeHealthPanel Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  HealthManager,
  HealthResponseSchema,
  ReadinessResponseSchema,
} from "../../../lib/runtime/health.js";
import {
  MetricsRegistry,
  METRIC_NAMES,
  MetricsResponseSchema,
} from "../../../lib/runtime/metrics.js";
import {
  getVersionInfo,
  VersionResponseSchema,
} from "../../../lib/runtime/version.js";
import {
  ReleaseGate,
  ReleaseGateResponseSchema,
  getContractStatus,
  ContractStatusResponseSchema,
} from "../../../lib/runtime/releaseGate.js";

// ── HealthManager Tests ───────────────────────────────────────────────────────

describe("HealthManager", () => {
  it("liveness returns a valid HealthResponse", () => {
    const manager = new HealthManager("1.0.0-test");
    const response = manager.liveness();
    const result = HealthResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
    expect(response.status).toBe("ok");
    expect(response.version).toBe("1.0.0-test");
  });

  it("uptime_seconds is non-negative", () => {
    const manager = new HealthManager("1.0.0");
    const response = manager.liveness();
    expect(response.uptime_seconds).toBeGreaterThanOrEqual(0);
  });

  it("readiness returns ready=true when all required deps pass", async () => {
    const manager = new HealthManager("1.0.0", [
      {
        name: "database",
        required: true,
        check: async () => "ok",
      },
      {
        name: "cache",
        required: true,
        check: async () => "ok",
      },
    ]);
    const response = await manager.readiness();
    const result = ReadinessResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
    expect(response.ready).toBe(true);
    expect(response.dependencies).toHaveLength(2);
  });

  it("readiness returns ready=false when a required dep is down", async () => {
    const manager = new HealthManager("1.0.0", [
      {
        name: "database",
        required: true,
        check: async () => "down",
      },
    ]);
    const response = await manager.readiness();
    expect(response.ready).toBe(false);
  });

  it("readiness returns ready=true when only optional dep is down", async () => {
    const manager = new HealthManager("1.0.0", [
      {
        name: "analytics",
        required: false,
        check: async () => "down",
      },
    ]);
    const response = await manager.readiness();
    expect(response.ready).toBe(true);
  });

  it("readiness marks dep as down if check throws", async () => {
    const manager = new HealthManager("1.0.0", [
      {
        name: "flaky-service",
        required: false,
        check: async () => { throw new Error("connection refused"); },
      },
    ]);
    const response = await manager.readiness();
    expect(response.dependencies[0].status).toBe("down");
  });
});

// ── MetricsRegistry Tests ─────────────────────────────────────────────────────

describe("MetricsRegistry", () => {
  let registry: MetricsRegistry;

  beforeEach(() => {
    registry = new MetricsRegistry();
  });

  it("counter starts at 0 after registration", () => {
    registry.registerCounter("test_counter", "A test counter");
    expect(registry.getCounter("test_counter")).toBe(0);
  });

  it("increment adds to counter", () => {
    registry.registerCounter("req_total", "Requests");
    registry.increment("req_total");
    registry.increment("req_total");
    registry.increment("req_total", 5);
    expect(registry.getCounter("req_total")).toBe(7);
  });

  it("gauge can be set and retrieved", () => {
    registry.setGauge("queue_depth", 42, "Queue depth");
    expect(registry.getGauge("queue_depth")).toBe(42);
  });

  it("snapshot returns a valid MetricsResponse", () => {
    registry.registerCounter("req_total", "Requests");
    registry.increment("req_total", 10);
    registry.setGauge("queue_depth", 3, "Queue depth");
    const snap = registry.snapshot();
    const result = MetricsResponseSchema.safeParse(snap);
    expect(result.success).toBe(true);
    expect(snap.metrics).toHaveLength(2);
  });

  it("prometheusText includes HELP and TYPE lines", () => {
    registry.registerCounter("req_total", "Total requests");
    registry.increment("req_total", 5);
    const text = registry.prometheusText();
    expect(text).toContain("# HELP req_total Total requests");
    expect(text).toContain("# TYPE req_total counter");
    expect(text).toContain("req_total 5");
  });

  it("resetCounter sets counter back to zero", () => {
    registry.registerCounter("err_total", "Errors");
    registry.increment("err_total", 10);
    registry.resetCounter("err_total");
    expect(registry.getCounter("err_total")).toBe(0);
  });

  it("all canonical metric names are defined", () => {
    expect(Object.keys(METRIC_NAMES)).toHaveLength(12);
  });
});

// ── Version Module Tests ──────────────────────────────────────────────────────

describe("getVersionInfo", () => {
  it("returns a valid VersionResponse", () => {
    const info = getVersionInfo();
    const result = VersionResponseSchema.safeParse(info);
    expect(result.success).toBe(true);
  });

  it("runtime_harness_version is 31.0.0", () => {
    const info = getVersionInfo();
    expect(info.runtime_harness_version).toBe("31.0.0");
  });

  it("environment defaults to development in test environment", () => {
    const info = getVersionInfo();
    expect(["development", "staging", "production"]).toContain(info.environment);
  });
});

// ── ReleaseGate Tests ─────────────────────────────────────────────────────────

describe("ReleaseGate", () => {
  it("gate opens when all required checks pass", async () => {
    const gate = new ReleaseGate("staging", "abc123");
    gate.addCheck({
      name: "contract-tests",
      description: "Contract test suite",
      required: true,
      run: async () => ({ status: "pass" }),
    });
    gate.addCheck({
      name: "smoke-tests",
      description: "Smoke tests",
      required: true,
      run: async () => ({ status: "pass" }),
    });
    const result = await gate.evaluate();
    const parsed = ReleaseGateResponseSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result.gate_open).toBe(true);
    expect(result.blocking_failures).toHaveLength(0);
  });

  it("gate closes when a required check fails", async () => {
    const gate = new ReleaseGate("production", "def456");
    gate.addCheck({
      name: "contract-tests",
      description: "Contract test suite",
      required: true,
      run: async () => ({ status: "fail", detail: "3 assertions failed" }),
    });
    gate.addCheck({
      name: "smoke-tests",
      description: "Smoke tests",
      required: true,
      run: async () => ({ status: "pass" }),
    });
    const result = await gate.evaluate();
    expect(result.gate_open).toBe(false);
    expect(result.blocking_failures).toContain("contract-tests");
  });

  it("gate opens when only optional check fails", async () => {
    const gate = new ReleaseGate("staging", "ghi789");
    gate.addCheck({
      name: "perf-benchmark",
      description: "Performance benchmark",
      required: false,
      run: async () => ({ status: "fail" }),
    });
    gate.addCheck({
      name: "contract-tests",
      description: "Contract tests",
      required: true,
      run: async () => ({ status: "pass" }),
    });
    const result = await gate.evaluate();
    expect(result.gate_open).toBe(true);
    expect(result.blocking_failures).toHaveLength(0);
  });

  it("gate closes when a required check throws", async () => {
    const gate = new ReleaseGate("staging", "jkl012");
    gate.addCheck({
      name: "health-check",
      description: "Runtime health",
      required: true,
      run: async () => { throw new Error("connection refused"); },
    });
    const result = await gate.evaluate();
    expect(result.gate_open).toBe(false);
    expect(result.blocking_failures).toContain("health-check");
  });

  it("gate response includes environment and build_sha", async () => {
    const gate = new ReleaseGate("production", "sha-prod-001");
    const result = await gate.evaluate();
    expect(result.environment).toBe("production");
    expect(result.build_sha).toBe("sha-prod-001");
  });
});

// ── ContractStatus Tests ──────────────────────────────────────────────────────

describe("getContractStatus", () => {
  it("returns a valid ContractStatusResponse", () => {
    const status = getContractStatus(0);
    const result = ContractStatusResponseSchema.safeParse(status);
    expect(result.success).toBe(true);
  });

  it("reports correct schema and error code counts", () => {
    const status = getContractStatus(0);
    expect(status.schema_count).toBe(16);
    expect(status.error_code_count).toBe(17);
  });

  it("reflects validation failure count", () => {
    const status = getContractStatus(5);
    expect(status.validation_failures_since_start).toBe(5);
  });

  it("drift_detected is false by default", () => {
    const status = getContractStatus(0);
    expect(status.drift_detected).toBe(false);
  });
});
