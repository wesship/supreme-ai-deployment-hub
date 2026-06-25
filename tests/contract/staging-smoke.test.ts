// @vitest-environment node
/**
 * D3VONN.IO — Staging Smoke Tests
 *
 * Validates that the deployed staging environment:
 * 1. Returns valid responses from all health/readiness/metrics/version endpoints
 * 2. Conforms to the canonical Zod schemas defined in src/lib/contracts/schemas.ts
 * 3. Does not return malformed data that would break the frontend
 *
 * These tests run against STAGING_BASE_URL (set via env var).
 * In CI, they run after the staging deployment completes.
 * They fail loudly if staging returns contract-violating data.
 *
 * For local development without a live staging URL, the tests run against
 * a mock server that simulates the expected responses.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "http";
import {
  HealthResponseSchema,
  ReadinessResponseSchema,
} from "../../src/lib/runtime/health.js";
import {
  MetricsResponseSchema,
} from "../../src/lib/runtime/metrics.js";
import {
  VersionResponseSchema,
} from "../../src/lib/runtime/version.js";
import {
  ReleaseGateResponseSchema,
  ContractStatusResponseSchema,
} from "../../src/lib/runtime/releaseGate.js";
import {
  ApiErrorResponseSchema,
} from "../../src/lib/contracts/schemas.js";

// ── Mock Server ───────────────────────────────────────────────────────────────

const MOCK_RESPONSES: Record<string, object> = {
  "/health": {
    status: "ok",
    uptime_seconds: 3600,
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  },
  "/ready": {
    ready: true,
    timestamp: new Date().toISOString(),
    dependencies: [
      { name: "database", status: "ok", required: true },
      { name: "cache", status: "ok", required: true },
      { name: "mcp-gateway", status: "ok", required: true },
    ],
  },
  "/metrics": {
    timestamp: new Date().toISOString(),
    metrics: [
      {
        name: "devonn_request_total",
        type: "counter",
        value: 1024,
        labels: {},
        description: "Total HTTP requests received",
        updated_at: new Date().toISOString(),
      },
      {
        name: "devonn_prediction_error_total",
        type: "counter",
        value: 3,
        labels: {},
        description: "Total prediction errors",
        updated_at: new Date().toISOString(),
      },
      {
        name: "devonn_queue_depth",
        type: "gauge",
        value: 2,
        labels: {},
        description: "Current job queue depth",
        updated_at: new Date().toISOString(),
      },
    ],
  },
  "/version": {
    version: "1.0.0",
    build_sha: "e7a49bdd20c1983f56a6917444b9de212bef0bda",
    build_time: new Date().toISOString(),
    environment: "staging",
    runtime_harness_version: "31.0.0",
  },
  "/contract/status": {
    contract_version: "1.0.0",
    schema_count: 16,
    last_drift_check: new Date().toISOString(),
    drift_detected: false,
    error_code_count: 17,
    validation_failures_since_start: 0,
  },
  "/release-gate": {
    gate_open: true,
    environment: "staging",
    build_sha: "e7a49bdd20c1983f56a6917444b9de212bef0bda",
    evaluated_at: new Date().toISOString(),
    checks: [
      { name: "contract-tests", description: "Contract test suite", required: true, status: "pass" },
      { name: "error-code-lock", description: "Error code lock tests", required: true, status: "pass" },
      { name: "smoke-tests", description: "Smoke tests", required: true, status: "pass" },
      { name: "health-check", description: "Runtime health", required: true, status: "pass" },
      { name: "schema-drift", description: "Schema drift check", required: true, status: "pass" },
    ],
    blocking_failures: [],
  },
};

let mockServer: Server;
let baseUrl: string;

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      // Use live staging URL if provided, otherwise start a mock server
      const stagingUrl = process.env.STAGING_BASE_URL;
      if (stagingUrl) {
        baseUrl = stagingUrl.replace(/\/$/, "");
        resolve();
        return;
      }

      mockServer = createServer((req, res) => {
        const path = req.url?.split("?")[0] ?? "/";
        const body = MOCK_RESPONSES[path];
        if (body) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(body));
        } else {
          // Return a valid error envelope for unknown paths
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: {
                code: "NOT_FOUND",
                message: `Path ${path} not found`,
                timestamp: new Date().toISOString(),
              },
            }),
          );
        }
      });

      mockServer.listen(0, "127.0.0.1", () => {
        const addr = mockServer.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    }),
  10_000,
);

afterAll(
  () =>
    new Promise<void>((resolve) => {
      if (mockServer) {
        mockServer.close(() => resolve());
      } else {
        resolve();
      }
    }),
);

// ── Helper ────────────────────────────────────────────────────────────────────

async function fetchEndpoint(path: string): Promise<unknown> {
  const response = await fetch(`${baseUrl}${path}`);
  return response.json();
}

// ── Health Endpoint ───────────────────────────────────────────────────────────

describe("GET /health — liveness probe", () => {
  it("returns a valid HealthResponse", async () => {
    const data = await fetchEndpoint("/health");
    const result = HealthResponseSchema.safeParse(data);
    expect(result.success, `Schema validation failed: ${JSON.stringify(result.error?.issues)}`).toBe(true);
  });

  it("status is ok or degraded (not down)", async () => {
    const data = await fetchEndpoint("/health") as any;
    expect(["ok", "degraded"]).toContain(data.status);
  });

  it("uptime_seconds is a non-negative number", async () => {
    const data = await fetchEndpoint("/health") as any;
    expect(typeof data.uptime_seconds).toBe("number");
    expect(data.uptime_seconds).toBeGreaterThanOrEqual(0);
  });

  it("timestamp is a valid ISO 8601 datetime", async () => {
    const data = await fetchEndpoint("/health") as any;
    expect(() => new Date(data.timestamp)).not.toThrow();
    expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
  });
});

// ── Readiness Endpoint ────────────────────────────────────────────────────────

describe("GET /ready — readiness probe", () => {
  it("returns a valid ReadinessResponse", async () => {
    const data = await fetchEndpoint("/ready");
    const result = ReadinessResponseSchema.safeParse(data);
    expect(result.success, `Schema validation failed: ${JSON.stringify(result.error?.issues)}`).toBe(true);
  });

  it("ready is true in staging (all required deps must be up)", async () => {
    const data = await fetchEndpoint("/ready") as any;
    expect(data.ready).toBe(true);
  });

  it("dependencies array is non-empty", async () => {
    const data = await fetchEndpoint("/ready") as any;
    expect(Array.isArray(data.dependencies)).toBe(true);
    expect(data.dependencies.length).toBeGreaterThan(0);
  });

  it("no required dependency is down", async () => {
    const data = await fetchEndpoint("/ready") as any;
    const failedRequired = data.dependencies.filter(
      (d: any) => d.required && d.status === "down",
    );
    expect(failedRequired).toHaveLength(0);
  });
});

// ── Metrics Endpoint ──────────────────────────────────────────────────────────

describe("GET /metrics — telemetry", () => {
  it("returns a valid MetricsResponse", async () => {
    const data = await fetchEndpoint("/metrics");
    const result = MetricsResponseSchema.safeParse(data);
    expect(result.success, `Schema validation failed: ${JSON.stringify(result.error?.issues)}`).toBe(true);
  });

  it("metrics array is non-empty", async () => {
    const data = await fetchEndpoint("/metrics") as any;
    expect(Array.isArray(data.metrics)).toBe(true);
    expect(data.metrics.length).toBeGreaterThan(0);
  });

  it("all metric types are counter or gauge", async () => {
    const data = await fetchEndpoint("/metrics") as any;
    for (const m of data.metrics) {
      expect(["counter", "gauge"]).toContain(m.type);
    }
  });

  it("all metric values are numbers", async () => {
    const data = await fetchEndpoint("/metrics") as any;
    for (const m of data.metrics) {
      expect(typeof m.value).toBe("number");
    }
  });
});

// ── Version Endpoint ──────────────────────────────────────────────────────────

describe("GET /version — build metadata", () => {
  it("returns a valid VersionResponse", async () => {
    const data = await fetchEndpoint("/version");
    const result = VersionResponseSchema.safeParse(data);
    expect(result.success, `Schema validation failed: ${JSON.stringify(result.error?.issues)}`).toBe(true);
  });

  it("environment is staging", async () => {
    const data = await fetchEndpoint("/version") as any;
    expect(data.environment).toBe("staging");
  });

  it("build_sha is non-empty", async () => {
    const data = await fetchEndpoint("/version") as any;
    expect(data.build_sha.length).toBeGreaterThan(0);
  });
});

// ── Contract Status Endpoint ──────────────────────────────────────────────────

describe("GET /contract/status — schema integrity", () => {
  it("returns a valid ContractStatusResponse", async () => {
    const data = await fetchEndpoint("/contract/status");
    const result = ContractStatusResponseSchema.safeParse(data);
    expect(result.success, `Schema validation failed: ${JSON.stringify(result.error?.issues)}`).toBe(true);
  });

  it("drift_detected is false in a healthy staging environment", async () => {
    const data = await fetchEndpoint("/contract/status") as any;
    expect(data.drift_detected).toBe(false);
  });

  it("schema_count is 16", async () => {
    const data = await fetchEndpoint("/contract/status") as any;
    expect(data.schema_count).toBe(16);
  });

  it("error_code_count is 17", async () => {
    const data = await fetchEndpoint("/contract/status") as any;
    expect(data.error_code_count).toBe(17);
  });
});

// ── Release Gate Endpoint ─────────────────────────────────────────────────────

describe("GET /release-gate — promotion readiness", () => {
  it("returns a valid ReleaseGateResponse", async () => {
    const data = await fetchEndpoint("/release-gate");
    const result = ReleaseGateResponseSchema.safeParse(data);
    expect(result.success, `Schema validation failed: ${JSON.stringify(result.error?.issues)}`).toBe(true);
  });

  it("gate_open is true in a healthy staging environment", async () => {
    const data = await fetchEndpoint("/release-gate") as any;
    expect(data.gate_open).toBe(true);
  });

  it("blocking_failures is empty when gate is open", async () => {
    const data = await fetchEndpoint("/release-gate") as any;
    if (data.gate_open) {
      expect(data.blocking_failures).toHaveLength(0);
    }
  });

  it("all required checks have passed", async () => {
    const data = await fetchEndpoint("/release-gate") as any;
    const failedRequired = data.checks.filter(
      (c: any) => c.required && c.status === "fail",
    );
    expect(failedRequired).toHaveLength(0);
  });
});

// ── 404 Error Shape ───────────────────────────────────────────────────────────

describe("Unknown endpoint — error shape contract", () => {
  it("returns a valid ApiErrorResponse for unknown paths", async () => {
    const response = await fetch(`${baseUrl}/unknown-path-xyz`);
    const data = await response.json();
    const result = ApiErrorResponseSchema.safeParse(data);
    expect(result.success, `Error shape violated: ${JSON.stringify(result.error?.issues)}`).toBe(true);
  });

  it("error code is NOT_FOUND for unknown paths", async () => {
    const response = await fetch(`${baseUrl}/unknown-path-xyz`);
    const data = await response.json() as any;
    expect(data.error.code).toBe("NOT_FOUND");
  });
});
