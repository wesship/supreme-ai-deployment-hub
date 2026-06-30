/**
 * D3VONN Rollback Plan
 *
 * Manages deployment rollback strategies, version tracking, and automated
 * rollback triggers for safe production deployments.
 *
 * @module shared/deployment/rollback-plan
 * @version 1.0.0
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type RollbackStrategy = "blue-green" | "canary" | "immediate" | "gradual";
export type RollbackStatus = "ready" | "in-progress" | "completed" | "failed" | "not-available";
export type TriggerType = "manual" | "automatic" | "health-check" | "error-rate" | "latency";

export interface DeploymentVersion {
  version: string;
  commitSha: string;
  deployedAt: string;
  environment: string;
  status: "active" | "previous" | "archived";
  artifacts: DeploymentArtifact[];
  healthScore: number;
  metadata: Record<string, unknown>;
}

export interface DeploymentArtifact {
  name: string;
  type: "docker-image" | "static-bundle" | "database-migration" | "config";
  reference: string;
  size?: number;
}

export interface RollbackTrigger {
  id: string;
  type: TriggerType;
  condition: string;
  threshold: number;
  windowMs: number;
  enabled: boolean;
  lastTriggered?: string;
}

export interface RollbackStep {
  order: number;
  name: string;
  description: string;
  command?: string;
  automated: boolean;
  estimatedDurationMs: number;
  rollbackable: boolean;
  verification?: string;
}

export interface RollbackPlan {
  id: string;
  createdAt: string;
  currentVersion: DeploymentVersion;
  targetVersion: DeploymentVersion;
  strategy: RollbackStrategy;
  status: RollbackStatus;
  triggers: RollbackTrigger[];
  steps: RollbackStep[];
  estimatedDurationMs: number;
  riskLevel: "low" | "medium" | "high";
  approvalRequired: boolean;
  approvedBy?: string;
  executedAt?: string;
  completedAt?: string;
  notes: string[];
}

export interface RollbackExecution {
  planId: string;
  startedAt: string;
  completedAt?: string;
  status: RollbackStatus;
  stepsCompleted: number;
  totalSteps: number;
  currentStep?: string;
  errors: string[];
  log: RollbackLogEntry[];
}

export interface RollbackLogEntry {
  timestamp: string;
  step: number;
  message: string;
  level: "info" | "warn" | "error";
}

// ─────────────────────────────────────────────────────────────────
// Default Triggers
// ─────────────────────────────────────────────────────────────────

export const DEFAULT_ROLLBACK_TRIGGERS: RollbackTrigger[] = [
  {
    id: "trigger-error-rate",
    type: "error-rate",
    condition: "Error rate exceeds threshold",
    threshold: 5, // 5% error rate
    windowMs: 300000, // 5 minutes
    enabled: true,
  },
  {
    id: "trigger-latency",
    type: "latency",
    condition: "P95 latency exceeds threshold",
    threshold: 5000, // 5 seconds
    windowMs: 300000,
    enabled: true,
  },
  {
    id: "trigger-health-check",
    type: "health-check",
    condition: "Health check failures exceed threshold",
    threshold: 3, // 3 consecutive failures
    windowMs: 60000, // 1 minute
    enabled: true,
  },
  {
    id: "trigger-dlq-spike",
    type: "automatic",
    condition: "DLQ depth spike after deployment",
    threshold: 50,
    windowMs: 600000, // 10 minutes
    enabled: true,
  },
];

// ─────────────────────────────────────────────────────────────────
// Default Rollback Steps
// ─────────────────────────────────────────────────────────────────

export function createRollbackSteps(strategy: RollbackStrategy): RollbackStep[] {
  const commonSteps: RollbackStep[] = [
    {
      order: 1,
      name: "Notify team",
      description: "Send rollback notification to engineering team",
      automated: true,
      estimatedDurationMs: 5000,
      rollbackable: true,
      verification: "Slack notification received",
    },
    {
      order: 2,
      name: "Pause event bus",
      description: "Pause event processing to prevent data inconsistency",
      command: "d3vonn events pause",
      automated: true,
      estimatedDurationMs: 10000,
      rollbackable: true,
      verification: "Event bus status: paused",
    },
  ];

  const strategySteps: Record<RollbackStrategy, RollbackStep[]> = {
    "blue-green": [
      {
        order: 3,
        name: "Switch traffic to green",
        description: "Route all traffic to the previous (green) deployment",
        command: "railway switch --target green",
        automated: true,
        estimatedDurationMs: 30000,
        rollbackable: true,
        verification: "Traffic routing to green confirmed",
      },
      {
        order: 4,
        name: "Verify green health",
        description: "Run health checks against the green deployment",
        command: "d3vonn health check --target green",
        automated: true,
        estimatedDurationMs: 15000,
        rollbackable: true,
        verification: "All health checks passing on green",
      },
      {
        order: 5,
        name: "Drain blue connections",
        description: "Gracefully drain remaining connections from blue",
        command: "railway drain --target blue --timeout 30s",
        automated: true,
        estimatedDurationMs: 30000,
        rollbackable: false,
      },
    ],
    canary: [
      {
        order: 3,
        name: "Remove canary",
        description: "Remove canary deployment and route all traffic to stable",
        command: "railway canary remove",
        automated: true,
        estimatedDurationMs: 15000,
        rollbackable: true,
        verification: "Canary removed, 100% traffic to stable",
      },
      {
        order: 4,
        name: "Verify stable",
        description: "Confirm stable deployment is healthy",
        command: "d3vonn health check --target stable",
        automated: true,
        estimatedDurationMs: 15000,
        rollbackable: true,
      },
    ],
    immediate: [
      {
        order: 3,
        name: "Redeploy previous version",
        description: "Deploy the previous stable version immediately",
        command: "railway deploy --version ${targetVersion}",
        automated: true,
        estimatedDurationMs: 120000,
        rollbackable: false,
        verification: "Previous version deployed and responding",
      },
      {
        order: 4,
        name: "Run database rollback",
        description: "Revert any database migrations if needed",
        command: "supabase migration revert --to ${targetMigration}",
        automated: false,
        estimatedDurationMs: 60000,
        rollbackable: false,
        verification: "Database schema matches target version",
      },
    ],
    gradual: [
      {
        order: 3,
        name: "Shift 25% traffic",
        description: "Route 25% of traffic to previous version",
        command: "railway traffic shift --target previous --weight 25",
        automated: true,
        estimatedDurationMs: 30000,
        rollbackable: true,
      },
      {
        order: 4,
        name: "Monitor 5 minutes",
        description: "Monitor error rates and latency for 5 minutes",
        automated: true,
        estimatedDurationMs: 300000,
        rollbackable: true,
        verification: "Error rate below 1%, P95 below 2s",
      },
      {
        order: 5,
        name: "Shift 75% traffic",
        description: "Route 75% of traffic to previous version",
        command: "railway traffic shift --target previous --weight 75",
        automated: true,
        estimatedDurationMs: 30000,
        rollbackable: true,
      },
      {
        order: 6,
        name: "Complete rollback",
        description: "Route 100% traffic to previous version",
        command: "railway traffic shift --target previous --weight 100",
        automated: true,
        estimatedDurationMs: 15000,
        rollbackable: false,
      },
    ],
  };

  const finalSteps: RollbackStep[] = [
    {
      order: 100,
      name: "Resume event bus",
      description: "Resume event processing with the rolled-back version",
      command: "d3vonn events resume",
      automated: true,
      estimatedDurationMs: 10000,
      rollbackable: true,
      verification: "Event bus status: running",
    },
    {
      order: 101,
      name: "Verify system health",
      description: "Run full system health check",
      command: "d3vonn health check --full",
      automated: true,
      estimatedDurationMs: 30000,
      rollbackable: true,
      verification: "System health: healthy",
    },
    {
      order: 102,
      name: "Post-rollback notification",
      description: "Notify team of rollback completion and status",
      automated: true,
      estimatedDurationMs: 5000,
      rollbackable: true,
    },
  ];

  const steps = [...commonSteps, ...strategySteps[strategy], ...finalSteps];
  // Re-number steps sequentially
  return steps.map((step, i) => ({ ...step, order: i + 1 }));
}

// ─────────────────────────────────────────────────────────────────
// Rollback Plan Manager
// ─────────────────────────────────────────────────────────────────

export class RollbackPlanManager {
  private versions: DeploymentVersion[] = [];
  private plans: RollbackPlan[] = [];
  private executions: RollbackExecution[] = [];

  registerVersion(version: DeploymentVersion): void {
    // Archive previous active version
    const current = this.versions.find((v) => v.status === "active");
    if (current) {
      current.status = "previous";
    }
    // Archive old previous versions
    this.versions
      .filter((v) => v.status === "previous" && v.version !== current?.version)
      .forEach((v) => { v.status = "archived"; });

    this.versions.push(version);
  }

  getCurrentVersion(): DeploymentVersion | undefined {
    return this.versions.find((v) => v.status === "active");
  }

  getPreviousVersion(): DeploymentVersion | undefined {
    return this.versions.find((v) => v.status === "previous");
  }

  getVersionHistory(): DeploymentVersion[] {
    return [...this.versions].sort(
      (a, b) => new Date(b.deployedAt).getTime() - new Date(a.deployedAt).getTime()
    );
  }

  createPlan(options?: {
    strategy?: RollbackStrategy;
    triggers?: RollbackTrigger[];
    approvalRequired?: boolean;
  }): RollbackPlan | null {
    const current = this.getCurrentVersion();
    const target = this.getPreviousVersion();

    if (!current || !target) return null;

    const strategy = options?.strategy ?? "blue-green";
    const steps = createRollbackSteps(strategy);
    const estimatedDurationMs = steps.reduce((sum, s) => sum + s.estimatedDurationMs, 0);

    const plan: RollbackPlan = {
      id: `rollback-${Date.now()}`,
      createdAt: new Date().toISOString(),
      currentVersion: current,
      targetVersion: target,
      strategy,
      status: "ready",
      triggers: options?.triggers ?? DEFAULT_ROLLBACK_TRIGGERS,
      steps,
      estimatedDurationMs,
      riskLevel: strategy === "immediate" ? "high" : strategy === "gradual" ? "low" : "medium",
      approvalRequired: options?.approvalRequired ?? true,
      notes: [],
    };

    this.plans.push(plan);
    return plan;
  }

  approvePlan(planId: string, approver: string): boolean {
    const plan = this.plans.find((p) => p.id === planId);
    if (!plan || plan.status !== "ready") return false;
    plan.approvedBy = approver;
    return true;
  }

  executePlan(planId: string): RollbackExecution | null {
    const plan = this.plans.find((p) => p.id === planId);
    if (!plan || plan.status !== "ready") return null;
    if (plan.approvalRequired && !plan.approvedBy) return null;

    plan.status = "in-progress";
    plan.executedAt = new Date().toISOString();

    const execution: RollbackExecution = {
      planId,
      startedAt: new Date().toISOString(),
      status: "in-progress",
      stepsCompleted: 0,
      totalSteps: plan.steps.length,
      errors: [],
      log: [],
    };

    // Simulate step execution
    for (const step of plan.steps) {
      execution.currentStep = step.name;
      execution.log.push({
        timestamp: new Date().toISOString(),
        step: step.order,
        message: `Executing: ${step.name}`,
        level: "info",
      });
      execution.stepsCompleted++;
    }

    execution.status = "completed";
    execution.completedAt = new Date().toISOString();
    plan.status = "completed";
    plan.completedAt = execution.completedAt;

    this.executions.push(execution);
    return execution;
  }

  getPlans(): RollbackPlan[] {
    return [...this.plans];
  }

  getExecutions(): RollbackExecution[] {
    return [...this.executions];
  }

  checkTriggers(metrics: {
    errorRate?: number;
    p95Latency?: number;
    healthFailures?: number;
    dlqDepth?: number;
  }): RollbackTrigger[] {
    const triggered: RollbackTrigger[] = [];
    const activePlan = this.plans.find((p) => p.status === "ready");
    if (!activePlan) return triggered;

    for (const trigger of activePlan.triggers) {
      if (!trigger.enabled) continue;

      let shouldTrigger = false;
      switch (trigger.type) {
        case "error-rate":
          shouldTrigger = (metrics.errorRate ?? 0) > trigger.threshold;
          break;
        case "latency":
          shouldTrigger = (metrics.p95Latency ?? 0) > trigger.threshold;
          break;
        case "health-check":
          shouldTrigger = (metrics.healthFailures ?? 0) >= trigger.threshold;
          break;
        case "automatic":
          shouldTrigger = (metrics.dlqDepth ?? 0) > trigger.threshold;
          break;
      }

      if (shouldTrigger) {
        trigger.lastTriggered = new Date().toISOString();
        triggered.push(trigger);
      }
    }

    return triggered;
  }
}

// ─────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────

export function createRollbackPlanManager(): RollbackPlanManager {
  return new RollbackPlanManager();
}
