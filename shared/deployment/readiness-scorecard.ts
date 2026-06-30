/**
 * D3VONN Production Readiness Scorecard
 *
 * Evaluates the platform against a comprehensive set of production readiness
 * criteria and generates a scored report with pass/fail gates.
 *
 * @module shared/deployment/readiness-scorecard
 * @version 1.0.0
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type CheckCategory =
  | "infrastructure"
  | "security"
  | "observability"
  | "data"
  | "performance"
  | "reliability"
  | "compliance";

export type CheckStatus = "pass" | "fail" | "warn" | "skip";
export type CheckPriority = "p0" | "p1" | "p2" | "p3";

export interface ReadinessCheck {
  id: string;
  name: string;
  category: CheckCategory;
  priority: CheckPriority;
  description: string;
  check: () => Promise<CheckResult> | CheckResult;
  remediation: string;
  weight: number;
}

export interface CheckResult {
  status: CheckStatus;
  message: string;
  details?: Record<string, unknown>;
}

export interface ScorecardResult {
  id: string;
  name: string;
  category: CheckCategory;
  priority: CheckPriority;
  status: CheckStatus;
  message: string;
  weight: number;
  details?: Record<string, unknown>;
}

export interface ReadinessScorecard {
  timestamp: string;
  environment: string;
  version: string;
  results: ScorecardResult[];
  score: number;
  maxScore: number;
  percentage: number;
  gate: "pass" | "fail";
  gateThreshold: number;
  categories: Record<CheckCategory, { score: number; maxScore: number; percentage: number }>;
  blockers: ScorecardResult[];
  warnings: ScorecardResult[];
}

// ─────────────────────────────────────────────────────────────────
// Default Readiness Checks
// ─────────────────────────────────────────────────────────────────

export function createDefaultChecks(context: ReadinessContext): ReadinessCheck[] {
  return [
    // Infrastructure (P0)
    {
      id: "infra-env-vars",
      name: "Required environment variables present",
      category: "infrastructure",
      priority: "p0",
      description: "All required environment variables are set for the target environment",
      check: () => ({
        status: context.envScore >= 90 ? "pass" : context.envScore >= 70 ? "warn" : "fail",
        message: `Environment score: ${context.envScore}%`,
        details: { score: context.envScore },
      }),
      remediation: "Set all required environment variables per the env-validator report",
      weight: 15,
    },
    {
      id: "infra-supabase",
      name: "Supabase configured",
      category: "infrastructure",
      priority: "p0",
      description: "Supabase URL and keys are configured and accessible",
      check: () => ({
        status: context.supabaseConfigured ? "pass" : "fail",
        message: context.supabaseConfigured ? "Supabase configured" : "Supabase not configured",
      }),
      remediation: "Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY",
      weight: 10,
    },
    {
      id: "infra-pinecone",
      name: "Pinecone configured",
      category: "infrastructure",
      priority: "p1",
      description: "Pinecone vector database is configured for agent memory",
      check: () => ({
        status: context.pineconeConfigured ? "pass" : "warn",
        message: context.pineconeConfigured ? "Pinecone configured" : "Pinecone not configured",
      }),
      remediation: "Set PINECONE_API_KEY, PINECONE_ENVIRONMENT, and PINECONE_INDEX",
      weight: 8,
    },
    {
      id: "infra-deploy-target",
      name: "Deployment target configured",
      category: "infrastructure",
      priority: "p0",
      description: "Railway or Vercel deployment target is configured",
      check: () => ({
        status: context.deployTargetConfigured ? "pass" : "fail",
        message: context.deployTargetConfigured ? "Deploy target ready" : "No deploy target configured",
      }),
      remediation: "Set RAILWAY_TOKEN or VERCEL_TOKEN for deployment",
      weight: 10,
    },

    // Security (P0)
    {
      id: "sec-no-secrets",
      name: "No secret values committed",
      category: "security",
      priority: "p0",
      description: "No secrets or credentials found in source code",
      check: () => ({
        status: context.secretsScore >= 100 ? "pass" : context.secretsScore >= 80 ? "warn" : "fail",
        message: `Secrets audit score: ${context.secretsScore}%`,
        details: { score: context.secretsScore, findings: context.secretFindings },
      }),
      remediation: "Remove all committed secrets and rotate affected credentials",
      weight: 15,
    },
    {
      id: "sec-rls-enabled",
      name: "Row-level security enabled",
      category: "security",
      priority: "p0",
      description: "RLS is enabled on all tenant-scoped tables",
      check: () => ({
        status: context.rlsEnabled ? "pass" : "fail",
        message: context.rlsEnabled ? "RLS enabled" : "RLS not enabled",
      }),
      remediation: "Apply the RLS migration: supabase/migrations/20260630_001_tenant_tables.sql",
      weight: 12,
    },
    {
      id: "sec-tenant-isolation",
      name: "Tenant isolation enabled",
      category: "security",
      priority: "p0",
      description: "Multi-tenant isolation is configured and tested",
      check: () => ({
        status: context.tenantIsolation ? "pass" : "fail",
        message: context.tenantIsolation ? "Tenant isolation active" : "Tenant isolation not configured",
      }),
      remediation: "Enable tenant context resolver and verify isolation smoke tests pass",
      weight: 12,
    },
    {
      id: "sec-rbac-active",
      name: "RBAC enforcer active",
      category: "security",
      priority: "p0",
      description: "RBAC deny-first policy enforcement is active",
      check: () => ({
        status: context.rbacActive ? "pass" : "fail",
        message: context.rbacActive ? "RBAC active" : "RBAC not configured",
      }),
      remediation: "Initialize the RBAC enforcer with default policies",
      weight: 10,
    },

    // Observability (P0)
    {
      id: "obs-sentry",
      name: "Sentry configured",
      category: "observability",
      priority: "p0",
      description: "Sentry error tracking is configured with valid DSN",
      check: () => ({
        status: context.sentryConfigured ? "pass" : "fail",
        message: context.sentryConfigured ? "Sentry configured" : "Sentry DSN not set",
      }),
      remediation: "Set SENTRY_DSN environment variable with valid Sentry project DSN",
      weight: 10,
    },
    {
      id: "obs-health-checks",
      name: "Health checks registered",
      category: "observability",
      priority: "p1",
      description: "Health check system is initialized with critical checks",
      check: () => ({
        status: context.healthChecksCount >= 5 ? "pass" : context.healthChecksCount >= 3 ? "warn" : "fail",
        message: `${context.healthChecksCount} health checks registered`,
        details: { count: context.healthChecksCount },
      }),
      remediation: "Initialize health check registry with default checks",
      weight: 5,
    },
    {
      id: "obs-alerts",
      name: "Alert rules configured",
      category: "observability",
      priority: "p1",
      description: "Alert rules are configured for DLQ, RBAC, and failures",
      check: () => ({
        status: context.alertRulesCount >= 6 ? "pass" : context.alertRulesCount >= 3 ? "warn" : "fail",
        message: `${context.alertRulesCount} alert rules configured`,
        details: { count: context.alertRulesCount },
      }),
      remediation: "Initialize alert manager with default rules",
      weight: 5,
    },

    // Data (P1)
    {
      id: "data-event-bus",
      name: "Event bus healthy",
      category: "data",
      priority: "p1",
      description: "Event bus is operational with no stuck messages",
      check: () => ({
        status: context.eventBusHealthy ? "pass" : "warn",
        message: context.eventBusHealthy ? "Event bus healthy" : "Event bus has issues",
      }),
      remediation: "Check event bus stats and clear any stuck DLQ entries",
      weight: 8,
    },
    {
      id: "data-dlq-clear",
      name: "DLQ empty or acknowledged",
      category: "data",
      priority: "p1",
      description: "Dead letter queue has no unacknowledged entries",
      check: () => ({
        status: context.dlqCount === 0 ? "pass" : context.dlqCount <= 5 ? "warn" : "fail",
        message: `DLQ entries: ${context.dlqCount}`,
        details: { count: context.dlqCount },
      }),
      remediation: "Review and acknowledge or replay DLQ entries",
      weight: 7,
    },

    // Reliability (P1)
    {
      id: "rel-rollback",
      name: "Rollback target available",
      category: "reliability",
      priority: "p1",
      description: "A rollback target (previous stable version) is identified",
      check: () => ({
        status: context.rollbackAvailable ? "pass" : "warn",
        message: context.rollbackAvailable ? "Rollback target available" : "No rollback target",
        details: { target: context.rollbackTarget },
      }),
      remediation: "Tag the current stable release before deploying",
      weight: 8,
    },
    {
      id: "rel-tests-pass",
      name: "All tests passing",
      category: "reliability",
      priority: "p0",
      description: "Unit tests and smoke tests all pass",
      check: () => ({
        status: context.testsPass ? "pass" : "fail",
        message: context.testsPass ? `${context.testCount} tests passing` : "Tests failing",
        details: { count: context.testCount },
      }),
      remediation: "Fix failing tests before deployment",
      weight: 12,
    },
    {
      id: "rel-build-success",
      name: "Build succeeds",
      category: "reliability",
      priority: "p0",
      description: "Production build completes without errors",
      check: () => ({
        status: context.buildSuccess ? "pass" : "fail",
        message: context.buildSuccess ? "Build successful" : "Build failed",
      }),
      remediation: "Fix build errors before deployment",
      weight: 12,
    },

    // Performance (P2)
    {
      id: "perf-bundle-size",
      name: "Bundle size within limits",
      category: "performance",
      priority: "p2",
      description: "Production bundle size is within acceptable limits",
      check: () => ({
        status: context.bundleSizeMB <= 5 ? "pass" : context.bundleSizeMB <= 10 ? "warn" : "fail",
        message: `Bundle size: ${context.bundleSizeMB.toFixed(1)} MB`,
        details: { sizeMB: context.bundleSizeMB },
      }),
      remediation: "Analyze bundle and apply code splitting or lazy loading",
      weight: 3,
    },

    // Compliance (P2)
    {
      id: "comp-knowledge-graph",
      name: "Knowledge graph validated",
      category: "compliance",
      priority: "p2",
      description: "Platform knowledge graph passes integrity checks",
      check: () => ({
        status: context.knowledgeGraphValid ? "pass" : "warn",
        message: context.knowledgeGraphValid ? "Knowledge graph valid" : "Knowledge graph has issues",
      }),
      remediation: "Run knowledge graph validation script",
      weight: 3,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────
// Context Interface
// ─────────────────────────────────────────────────────────────────

export interface ReadinessContext {
  envScore: number;
  supabaseConfigured: boolean;
  pineconeConfigured: boolean;
  deployTargetConfigured: boolean;
  secretsScore: number;
  secretFindings: number;
  rlsEnabled: boolean;
  tenantIsolation: boolean;
  rbacActive: boolean;
  sentryConfigured: boolean;
  healthChecksCount: number;
  alertRulesCount: number;
  eventBusHealthy: boolean;
  dlqCount: number;
  rollbackAvailable: boolean;
  rollbackTarget?: string;
  testsPass: boolean;
  testCount: number;
  buildSuccess: boolean;
  bundleSizeMB: number;
  knowledgeGraphValid: boolean;
}

// ─────────────────────────────────────────────────────────────────
// Scorecard Engine
// ─────────────────────────────────────────────────────────────────

export class ReadinessScorecardEngine {
  private checks: ReadinessCheck[];
  private gateThreshold: number;

  constructor(options?: { checks?: ReadinessCheck[]; gateThreshold?: number }) {
    this.checks = options?.checks ?? [];
    this.gateThreshold = options?.gateThreshold ?? 90;
  }

  async evaluate(environment: string, version: string): Promise<ReadinessScorecard> {
    const results: ScorecardResult[] = [];

    for (const check of this.checks) {
      try {
        const result = await check.check();
        results.push({
          id: check.id,
          name: check.name,
          category: check.category,
          priority: check.priority,
          status: result.status,
          message: result.message,
          weight: check.weight,
          details: result.details,
        });
      } catch (error) {
        results.push({
          id: check.id,
          name: check.name,
          category: check.category,
          priority: check.priority,
          status: "fail",
          message: `Check threw error: ${(error as Error).message}`,
          weight: check.weight,
        });
      }
    }

    // Calculate scores
    const maxScore = results.reduce((sum, r) => sum + r.weight, 0);
    const score = results.reduce((sum, r) => {
      if (r.status === "pass") return sum + r.weight;
      if (r.status === "warn") return sum + r.weight * 0.5;
      return sum;
    }, 0);
    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

    // Category breakdown
    const allCategories: CheckCategory[] = [
      "infrastructure", "security", "observability", "data", "performance", "reliability", "compliance",
    ];
    const categories = {} as Record<CheckCategory, { score: number; maxScore: number; percentage: number }>;
    for (const cat of allCategories) {
      const catResults = results.filter((r) => r.category === cat);
      const catMax = catResults.reduce((s, r) => s + r.weight, 0);
      const catScore = catResults.reduce((s, r) => {
        if (r.status === "pass") return s + r.weight;
        if (r.status === "warn") return s + r.weight * 0.5;
        return s;
      }, 0);
      categories[cat] = {
        score: catScore,
        maxScore: catMax,
        percentage: catMax > 0 ? Math.round((catScore / catMax) * 100) : 100,
      };
    }

    // Gate decision: fail if any P0 check fails
    const p0Failures = results.filter((r) => r.priority === "p0" && r.status === "fail");
    const gate = p0Failures.length === 0 && percentage >= this.gateThreshold ? "pass" : "fail";

    return {
      timestamp: new Date().toISOString(),
      environment,
      version,
      results,
      score,
      maxScore,
      percentage,
      gate,
      gateThreshold: this.gateThreshold,
      categories,
      blockers: results.filter((r) => r.status === "fail"),
      warnings: results.filter((r) => r.status === "warn"),
    };
  }

  addCheck(check: ReadinessCheck): void {
    this.checks.push(check);
  }

  getChecks(): ReadinessCheck[] {
    return [...this.checks];
  }

  setGateThreshold(threshold: number): void {
    this.gateThreshold = threshold;
  }
}

// ─────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────

export function createReadinessScorecard(
  context: ReadinessContext,
  options?: { gateThreshold?: number }
): ReadinessScorecardEngine {
  const checks = createDefaultChecks(context);
  return new ReadinessScorecardEngine({
    checks,
    gateThreshold: options?.gateThreshold ?? 90,
  });
}
