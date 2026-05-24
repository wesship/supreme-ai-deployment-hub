/**
 * Cluster-integrated Canary Router
 *
 * Uses deterministic SHA-256 hash-based routing so the same tenant
 * always gets the same routing decision — critical for session stability.
 * Reads live config from the ControlPlaneController.
 */

import { createHash } from "crypto";
import type { ControlPlaneController } from "./controlPlaneController.js";

export interface CanaryRoutingDecision {
  tenantId: string;
  routeToCanary: boolean;
  stage: string;
  percentage: number;
  hashBucket: number;
  reason: string;
}

export class ClusterCanaryRouter {
  constructor(private readonly controlPlane: ControlPlaneController) {}

  /**
   * Determine whether a given tenant should be routed to the canary deployment.
   *
   * Uses SHA-256 of the tenantId to produce a stable 0-99 bucket value.
   * This ensures the same tenant always gets the same routing decision
   * for the lifetime of a canary stage, preventing session fragmentation.
   */
  async shouldRouteToCanary(tenantId: string): Promise<CanaryRoutingDecision> {
    const config = await this.controlPlane.getConfig();

    // Hard gate: if execution is paused or canary is disabled, always route to stable
    if (config.globalExecutionPause) {
      return {
        tenantId, routeToCanary: false,
        stage: config.canaryStage, percentage: config.canaryPercentage,
        hashBucket: -1,
        reason: "GLOBAL_EXECUTION_PAUSE is active — routing to stable",
      };
    }

    if (!config.canaryEnabled || config.canaryStage === "C0") {
      return {
        tenantId, routeToCanary: false,
        stage: config.canaryStage, percentage: config.canaryPercentage,
        hashBucket: -1,
        reason: `Canary disabled or at stage C0`,
      };
    }

    // Deterministic hash bucket (0-99)
    const hash = createHash("sha256").update(tenantId).digest("hex");
    const bucket = parseInt(hash.slice(0, 8), 16) % 100;
    const routeToCanary = bucket < config.canaryPercentage;

    return {
      tenantId,
      routeToCanary,
      stage: config.canaryStage,
      percentage: config.canaryPercentage,
      hashBucket: bucket,
      reason: routeToCanary
        ? `Bucket ${bucket} < ${config.canaryPercentage}% threshold — canary`
        : `Bucket ${bucket} >= ${config.canaryPercentage}% threshold — stable`,
    };
  }
}
