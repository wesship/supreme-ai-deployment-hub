/**
 * D3VONN — Runtime Health Module
 *
 * Provides /health and /ready endpoint logic.
 * /health: liveness — is the process alive?
 * /ready:  readiness — are all required dependencies reachable?
 */

import { z } from "zod";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DependencyStatus = "ok" | "degraded" | "down" | "unknown";

export interface DependencyCheck {
  name: string;
  required: boolean;
  check: () => Promise<DependencyStatus>;
}

export interface HealthResponse {
  status: "ok" | "degraded" | "down";
  uptime_seconds: number;
  timestamp: string;
  version: string;
}

export interface ReadinessResponse {
  ready: boolean;
  timestamp: string;
  dependencies: Array<{
    name: string;
    status: DependencyStatus;
    required: boolean;
  }>;
}

// ── Schemas (for contract validation) ────────────────────────────────────────

export const HealthResponseSchema = z.object({
  status: z.enum(["ok", "degraded", "down"]),
  uptime_seconds: z.number().nonnegative(),
  timestamp: z.string().datetime(),
  version: z.string().min(1),
});

export const ReadinessResponseSchema = z.object({
  ready: z.boolean(),
  timestamp: z.string().datetime(),
  dependencies: z.array(
    z.object({
      name: z.string(),
      status: z.enum(["ok", "degraded", "down", "unknown"]),
      required: z.boolean(),
    }),
  ),
});

// ── Health Manager ────────────────────────────────────────────────────────────

export class HealthManager {
  private readonly startTime: number;
  private readonly version: string;
  private readonly dependencies: DependencyCheck[];

  constructor(version: string, dependencies: DependencyCheck[] = []) {
    this.startTime = Date.now();
    this.version = version;
    this.dependencies = dependencies;
  }

  /** /health — liveness check. Always returns quickly. */
  liveness(): HealthResponse {
    return {
      status: "ok",
      uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
      version: this.version,
    };
  }

  /** /ready — readiness check. Runs all dependency probes. */
  async readiness(): Promise<ReadinessResponse> {
    const results = await Promise.all(
      this.dependencies.map(async (dep) => {
        let status: DependencyStatus = "unknown";
        try {
          status = await dep.check();
        } catch {
          status = "down";
        }
        return { name: dep.name, status, required: dep.required };
      }),
    );

    const allRequiredOk = results
      .filter((r) => r.required)
      .every((r) => r.status === "ok");

    return {
      ready: allRequiredOk,
      timestamp: new Date().toISOString(),
      dependencies: results,
    };
  }
}

// ── Default Instance ──────────────────────────────────────────────────────────

const BUILD_VERSION =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_BUILD_SHA) ||
  process.env.BUILD_SHA ||
  "dev";

export const healthManager = new HealthManager(BUILD_VERSION);
