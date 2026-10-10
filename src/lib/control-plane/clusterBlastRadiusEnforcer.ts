/**
 * Cluster-integrated Blast Radius Enforcer
 *
 * Reads per-tenant limits from the ControlPlaneController and
 * enforces them at request time. In strict mode, violations throw.
 * In permissive mode, violations are logged only.
 */

import type { ControlPlaneController } from "./controlPlaneController.js";

export interface ExecutionRequest {
  tenantId: string;
  activeAgentsForTenant: number;
  systemLoadPercent: number;
}

export interface BlastRadiusDecision {
  allowed: boolean;
  mode: "strict" | "permissive";
  reason: string;
}

export class ClusterBlastRadiusEnforcer {
  constructor(private readonly controlPlane: ControlPlaneController) {}

  async enforce(request: ExecutionRequest): Promise<BlastRadiusDecision> {
    const config = await this.controlPlane.getConfig();
    const mode = config.blastRadiusMode;

    // Check per-tenant agent limit
    if (request.activeAgentsForTenant >= config.blastRadiusMaxAgentsPerTenant) {
      const reason = `Tenant '${request.tenantId}' has ${request.activeAgentsForTenant} active agents, limit is ${config.blastRadiusMaxAgentsPerTenant}`;
      if (mode === "strict") {
        return { allowed: false, mode, reason };
      } else {
        console.warn(`[blast-radius] PERMISSIVE: ${reason}`);
      }
    }

    // Check global system load (>90% = reject new executions)
    if (request.systemLoadPercent > 90) {
      const reason = `System load ${request.systemLoadPercent}% exceeds global threshold of 90%`;
      if (mode === "strict") {
        return { allowed: false, mode, reason };
      } else {
        console.warn(`[blast-radius] PERMISSIVE: ${reason}`);
      }
    }

    return {
      allowed: true,
      mode,
      reason: `Execution allowed for tenant '${request.tenantId}' (${request.activeAgentsForTenant}/${config.blastRadiusMaxAgentsPerTenant} agents, system load ${request.systemLoadPercent}%)`,
    };
  }
}
