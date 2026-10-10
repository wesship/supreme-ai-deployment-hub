/**
 * Phase 1 — Canary Routing Layer
 *
 * Implements the gradual traffic ramp model (C0 → C4) and
 * risk-class-based routing logic. All requests must be tagged
 * before entering the execution pipeline.
 */

export type CanaryStage = "C0" | "C1" | "C2" | "C3" | "C4";
export type RiskClass = "low" | "medium" | "high";
export type DeploymentMode = "canary" | "stable";

/** Traffic percentage and allowed risk classes per stage. */
export const CANARY_STAGE_CONFIG: Record<
  CanaryStage,
  { trafficPercent: number; allowedRiskClasses: RiskClass[]; minDurationMs: number }
> = {
  C0: { trafficPercent: 0, allowedRiskClasses: [], minDurationMs: 0 },
  C1: { trafficPercent: 0.5, allowedRiskClasses: ["low"], minDurationMs: 2 * 60 * 60 * 1000 },
  C2: { trafficPercent: 1, allowedRiskClasses: ["low"], minDurationMs: 12 * 60 * 60 * 1000 },
  C3: { trafficPercent: 3, allowedRiskClasses: ["low", "medium"], minDurationMs: 24 * 60 * 60 * 1000 },
  C4: { trafficPercent: 5, allowedRiskClasses: ["low", "medium", "high"], minDurationMs: 48 * 60 * 60 * 1000 },
};

export interface CanaryRequest {
  requestId: string;
  tenantId: string;
  riskClass: RiskClass;
  deploymentMode?: DeploymentMode;
}

export interface RoutingDecision {
  requestId: string;
  routed: boolean;
  deploymentMode: DeploymentMode;
  stage: CanaryStage;
  reason: string;
}

export class CanaryRouter {
  private currentStage: CanaryStage = "C0";
  private stageEnteredAt: number = Date.now();

  /** Get the current active canary stage. */
  getStage(): CanaryStage {
    return this.currentStage;
  }

  /**
   * Advance to the next canary stage.
   * Throws if the minimum duration for the current stage has not elapsed.
   */
  advanceStage(): CanaryStage {
    const stageOrder: CanaryStage[] = ["C0", "C1", "C2", "C3", "C4"];
    const currentIndex = stageOrder.indexOf(this.currentStage);

    if (currentIndex === stageOrder.length - 1) {
      throw new Error("Already at maximum canary stage C4");
    }

    const config = CANARY_STAGE_CONFIG[this.currentStage];
    const elapsed = Date.now() - this.stageEnteredAt;

    if (elapsed < config.minDurationMs && config.minDurationMs > 0) {
      const remaining = Math.ceil((config.minDurationMs - elapsed) / 1000 / 60);
      throw new CanaryAdvanceError(
        this.currentStage,
        `Minimum stage duration not met. ${remaining} minutes remaining.`
      );
    }

    this.currentStage = stageOrder[currentIndex + 1];
    this.stageEnteredAt = Date.now();
    return this.currentStage;
  }

  /**
   * Route an incoming request.
   * Returns a routing decision indicating whether the request should go
   * to the canary deployment or the stable deployment.
   */
  route(request: CanaryRequest): RoutingDecision {
    const stage = this.currentStage;
    const config = CANARY_STAGE_CONFIG[stage];

    // C0: no canary traffic
    if (stage === "C0") {
      return {
        requestId: request.requestId,
        routed: false,
        deploymentMode: "stable",
        stage,
        reason: "Canary stage C0: no traffic routed to canary",
      };
    }

    // Risk class gate: high-risk requests are blocked until C3+
    if (!config.allowedRiskClasses.includes(request.riskClass)) {
      return {
        requestId: request.requestId,
        routed: false,
        deploymentMode: "stable",
        stage,
        reason: `Risk class '${request.riskClass}' not allowed at stage ${stage}`,
      };
    }

    // Probabilistic traffic split based on stage percentage
    const roll = Math.random() * 100;
    const routed = roll < config.trafficPercent;

    return {
      requestId: request.requestId,
      routed,
      deploymentMode: routed ? "canary" : "stable",
      stage,
      reason: routed
        ? `Routed to canary (${config.trafficPercent}% at stage ${stage})`
        : `Routed to stable (roll ${roll.toFixed(2)} >= ${config.trafficPercent})`,
    };
  }

  /** Force-set stage (for testing and emergency override only). */
  forceStage(stage: CanaryStage): void {
    this.currentStage = stage;
    this.stageEnteredAt = Date.now();
  }
}

export class CanaryAdvanceError extends Error {
  constructor(readonly stage: CanaryStage, message: string) {
    super(`Cannot advance from stage ${stage}: ${message}`);
    this.name = "CanaryAdvanceError";
  }
}

/** Singleton canary router for use across the runtime. */
export const canaryRouter = new CanaryRouter();

/**
 * Kubernetes Ingress annotation values for the current canary stage.
 * Intended for use by the GitOps pipeline when updating ingress weights.
 */
export function getIngressAnnotations(stage: CanaryStage): Record<string, string> {
  const config = CANARY_STAGE_CONFIG[stage];
  return {
    "nginx.ingress.kubernetes.io/canary": stage === "C0" ? "false" : "true",
    "nginx.ingress.kubernetes.io/canary-weight": String(
      Math.round(config.trafficPercent * 10) // NGINX weight is 0-1000
    ),
  };
}
