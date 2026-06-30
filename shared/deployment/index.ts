/**
 * D3VONN Deployment Hardening
 *
 * Comprehensive deployment safety layer providing environment validation,
 * secrets auditing, release checklists, rollback planning, readiness scoring,
 * and deployment health monitoring.
 *
 * @module shared/deployment
 * @version 1.0.0
 */

// ─────────────────────────────────────────────────────────────────
// Re-exports
// ─────────────────────────────────────────────────────────────────

export {
  EnvironmentValidator,
  createEnvironmentValidator,
  ENV_VAR_REGISTRY,
  type Environment,
  type VarCategory,
  type EnvVarDefinition,
  type ValidationResult,
  type EnvironmentReport,
} from "./env-validator";

export {
  SecretsAuditor,
  createSecretsAuditor,
  SECRET_PATTERNS,
  DEFAULT_ROTATION_POLICIES,
  type SecretPattern,
  type SecretFinding,
  type SecretRotationPolicy,
  type SecretsAuditReport,
  type SecretSeverity,
  type SecretStatus,
} from "./secrets-audit";

export {
  ReadinessScorecardEngine,
  createReadinessScorecard,
  createDefaultChecks,
  type ReadinessCheck,
  type ReadinessContext,
  type ReadinessScorecard,
  type CheckCategory,
  type CheckStatus,
  type CheckPriority,
  type CheckResult,
  type ScorecardResult,
} from "./readiness-scorecard";

export {
  RollbackPlanManager,
  createRollbackPlanManager,
  createRollbackSteps,
  DEFAULT_ROLLBACK_TRIGGERS,
  type RollbackPlan,
  type RollbackStrategy,
  type RollbackStatus,
  type RollbackStep,
  type RollbackTrigger,
  type RollbackExecution,
  type DeploymentVersion,
  type DeploymentArtifact,
} from "./rollback-plan";

export {
  ReleaseChecklistManager,
  createReleaseChecklistManager,
  DEFAULT_CHECKLIST_ITEMS,
  type ReleaseChecklist,
  type ChecklistItem,
  type ChecklistPhase,
  type ItemStatus,
  type ItemType,
} from "./release-checklist";

export {
  DeploymentHealthMonitor,
  createDeploymentHealthMonitor,
  DEFAULT_DEPLOYMENT_WINDOWS,
  type DeploymentHealthStatus,
  type DeploymentPhase,
  type DeploymentMetrics,
  type HealthCheckResult,
  type CanaryAnalysis,
  type DeploymentWindow,
} from "./deployment-health";

// ─────────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────────

import { EnvironmentValidator } from "./env-validator";
import { createSecretsAuditor, SecretsAuditor } from "./secrets-audit";
import { createRollbackPlanManager, RollbackPlanManager } from "./rollback-plan";
import { createReleaseChecklistManager, ReleaseChecklistManager } from "./release-checklist";
import { createDeploymentHealthMonitor, DeploymentHealthMonitor } from "./deployment-health";

export interface DeploymentStack {
  envValidator: EnvironmentValidator;
  secretsAuditor: SecretsAuditor;
  rollbackManager: RollbackPlanManager;
  checklistManager: ReleaseChecklistManager;
  healthMonitor: DeploymentHealthMonitor;
}

export function bootstrapDeployment(options: {
  environment: string;
  version: string;
  envSource?: Record<string, string | undefined>;
}): DeploymentStack {
  return {
    envValidator: new EnvironmentValidator(undefined, options.envSource),
    secretsAuditor: createSecretsAuditor(),
    rollbackManager: createRollbackPlanManager(),
    checklistManager: createReleaseChecklistManager(),
    healthMonitor: createDeploymentHealthMonitor({
      version: options.version,
      environment: options.environment,
    }),
  };
}
