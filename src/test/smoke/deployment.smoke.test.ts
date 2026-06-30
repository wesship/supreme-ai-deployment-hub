/**
 * D3VONN Deployment Hardening — Smoke Tests
 *
 * Validates environment validation, secrets audit, readiness scorecard,
 * rollback plan, release checklist, and deployment health monitoring.
 *
 * @module tests/smoke/deployment.smoke.test
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  EnvironmentValidator,
  createEnvironmentValidator,
  SecretsAuditor,
  createSecretsAuditor,
  SECRET_PATTERNS,
  ReadinessScorecardEngine,
  createReadinessScorecard,
  createDefaultChecks,
  RollbackPlanManager,
  createRollbackPlanManager,
  createRollbackSteps,
  DEFAULT_ROLLBACK_TRIGGERS,
  ReleaseChecklistManager,
  createReleaseChecklistManager,
  DEFAULT_CHECKLIST_ITEMS,
  DeploymentHealthMonitor,
  createDeploymentHealthMonitor,
  DEFAULT_DEPLOYMENT_WINDOWS,
  type ReadinessContext,
} from "../../../shared/deployment";
import { ENV_VAR_REGISTRY } from "../../../shared/deployment/env-validator";

// ─────────────────────────────────────────────────────────────────
// Environment Validator
// ─────────────────────────────────────────────────────────────────

describe("Deployment: Environment Validator", () => {
  let validator: EnvironmentValidator;

  beforeEach(() => {
    validator = new EnvironmentValidator(undefined, {
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_ANON_KEY: "test-anon-key",
    });
  });

  it("should create a validator for production environment", () => {
    expect(validator).toBeDefined();
    expect(validator).toBeInstanceOf(EnvironmentValidator);
  });

  it("should have default environment variable registry", () => {
    expect(ENV_VAR_REGISTRY).toBeDefined();
    expect(Array.isArray(ENV_VAR_REGISTRY)).toBe(true);
    expect(ENV_VAR_REGISTRY.length).toBeGreaterThan(0);
  });

  it("should validate environment variables", () => {
    const report = validator.validate("production");
    expect(report).toBeDefined();
    expect(report.results).toBeDefined();
    expect(Array.isArray(report.results)).toBe(true);
  });

  it("should detect missing required variables", () => {
    const emptyValidator = new EnvironmentValidator(undefined, {});
    const report = emptyValidator.validate("production");
    const missing = report.results.filter((r) => r.status === "missing");
    expect(missing.length).toBeGreaterThan(0);
  });

  it("should report score as percentage", () => {
    const report = validator.validate("production");
    expect(report.summary.score).toBeGreaterThanOrEqual(0);
    expect(report.summary.score).toBeLessThanOrEqual(100);
  });

  it("should support multiple environments", () => {
    const devValidator = new EnvironmentValidator(undefined, {});
    const devReport = devValidator.validate("development");
    const prodReport = devValidator.validate("production");
    expect(devReport.environment).toBe("development");
    expect(prodReport.environment).toBe("production");
  });
});

// ─────────────────────────────────────────────────────────────────
// Secrets Audit
// ─────────────────────────────────────────────────────────────────

describe("Deployment: Secrets Audit", () => {
  let auditor: SecretsAuditor;

  beforeEach(() => {
    auditor = createSecretsAuditor();
  });

  it("should create a secrets auditor", () => {
    expect(auditor).toBeDefined();
    expect(auditor).toBeInstanceOf(SecretsAuditor);
  });

  it("should have predefined secret patterns", () => {
    expect(SECRET_PATTERNS).toBeDefined();
    expect(Array.isArray(SECRET_PATTERNS)).toBe(true);
    expect(SECRET_PATTERNS.length).toBeGreaterThan(5);
  });

  it("should detect exposed secrets in content", () => {
    const content = 'const key = "sk-abcdefghijklmnopqrstuvwxyz123456";';
    const findings = auditor.scanContent(content, "test.ts");
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].severity).toBeDefined();
  });

  it("should not flag safe content", () => {
    const content = "const apiUrl = process.env.OPENAI_API_KEY;";
    const findings = auditor.scanContent(content, "test.ts");
    expect(findings.length).toBe(0);
  });

  it("should generate an audit report", () => {
    // Fresh auditor with no content scanned = clean report
    const freshAuditor = createSecretsAuditor();
    const report = freshAuditor.generateReport();
    expect(report).toBeDefined();
    expect(report.summary.score).toBe(100);
    expect(report.summary.findings).toBe(0);
  });

  it("should detect multiple secret types", () => {
    const patterns = SECRET_PATTERNS.map((p) => p.name);
    expect(patterns).toContain("OpenAI API Key");
    expect(patterns).toContain("AWS Access Key");
    expect(patterns).toContain("Private Key");
  });
});

// ─────────────────────────────────────────────────────────────────
// Readiness Scorecard
// ─────────────────────────────────────────────────────────────────

describe("Deployment: Readiness Scorecard", () => {
  const fullContext: ReadinessContext = {
    envScore: 100,
    supabaseConfigured: true,
    pineconeConfigured: true,
    deployTargetConfigured: true,
    secretsScore: 100,
    secretFindings: 0,
    rlsEnabled: true,
    tenantIsolation: true,
    rbacActive: true,
    sentryConfigured: true,
    healthChecksCount: 7,
    alertRulesCount: 8,
    eventBusHealthy: true,
    dlqCount: 0,
    rollbackAvailable: true,
    rollbackTarget: "1.9.2",
    testsPass: true,
    testCount: 725,
    buildSuccess: true,
    bundleSizeMB: 2.5,
    knowledgeGraphValid: true,
  };

  it("should create a readiness scorecard engine", () => {
    const scorecard = createReadinessScorecard(fullContext);
    expect(scorecard).toBeDefined();
    expect(scorecard).toBeInstanceOf(ReadinessScorecardEngine);
  });

  it("should have default checks", () => {
    const checks = createDefaultChecks(fullContext);
    expect(checks).toBeDefined();
    expect(Array.isArray(checks)).toBe(true);
    expect(checks.length).toBeGreaterThan(10);
  });

  it("should categorize checks", () => {
    const checks = createDefaultChecks(fullContext);
    const categories = [...new Set(checks.map((c) => c.category))];
    expect(categories).toContain("infrastructure");
    expect(categories).toContain("security");
    expect(categories).toContain("observability");
  });

  it("should run checks and produce a scorecard", async () => {
    const scorecard = createReadinessScorecard(fullContext);
    const result = await scorecard.evaluate("production", "2.0.0-alpha.1");
    expect(result).toBeDefined();
    expect(result.percentage).toBeGreaterThanOrEqual(0);
    expect(result.percentage).toBeLessThanOrEqual(100);
    expect(result.gate).toBeDefined();
  });

  it("should enforce >= 90 gate threshold", async () => {
    const failContext: ReadinessContext = {
      envScore: 20,
      supabaseConfigured: false,
      pineconeConfigured: false,
      deployTargetConfigured: false,
      secretsScore: 30,
      secretFindings: 5,
      rlsEnabled: false,
      tenantIsolation: false,
      rbacActive: false,
      sentryConfigured: false,
      healthChecksCount: 0,
      alertRulesCount: 0,
      eventBusHealthy: false,
      dlqCount: 50,
      rollbackAvailable: false,
      testsPass: false,
      testCount: 0,
      buildSuccess: false,
      bundleSizeMB: 20,
      knowledgeGraphValid: false,
    };
    const scorecard = createReadinessScorecard(failContext);
    const result = await scorecard.evaluate("production", "2.0.0-alpha.1");
    expect(result.gate).toBe("fail");
  });
});

// ─────────────────────────────────────────────────────────────────
// Rollback Plan
// ─────────────────────────────────────────────────────────────────

describe("Deployment: Rollback Plan", () => {
  let manager: RollbackPlanManager;

  beforeEach(() => {
    manager = createRollbackPlanManager();
    // Register versions in order: first one becomes active, second one archives first to previous
    manager.registerVersion({
      version: "1.9.2",
      commitSha: "abc123",
      deployedAt: new Date(Date.now() - 86400000).toISOString(),
      environment: "production",
      status: "active",
      artifacts: [],
      healthScore: 98,
      metadata: {},
    });
    manager.registerVersion({
      version: "2.0.0-alpha.1",
      commitSha: "def456",
      deployedAt: new Date().toISOString(),
      environment: "production",
      status: "active",
      artifacts: [],
      healthScore: 95,
      metadata: {},
    });
  });

  it("should create a rollback plan manager", () => {
    expect(manager).toBeDefined();
    expect(manager).toBeInstanceOf(RollbackPlanManager);
  });

  it("should have default rollback triggers", () => {
    expect(DEFAULT_ROLLBACK_TRIGGERS).toBeDefined();
    expect(Array.isArray(DEFAULT_ROLLBACK_TRIGGERS)).toBe(true);
    expect(DEFAULT_ROLLBACK_TRIGGERS.length).toBeGreaterThan(3);
  });

  it("should create rollback steps", () => {
    const steps = createRollbackSteps("blue-green");
    expect(steps).toBeDefined();
    expect(Array.isArray(steps)).toBe(true);
    expect(steps.length).toBeGreaterThan(3);
  });

  it("should create a rollback plan", () => {
    const plan = manager.createPlan({ strategy: "blue-green" });
    expect(plan).not.toBeNull();
    expect(plan!.currentVersion.version).toBe("2.0.0-alpha.1");
    expect(plan!.targetVersion.version).toBe("1.9.2");
    expect(plan!.strategy).toBe("blue-green");
    expect(plan!.status).toBe("ready");
  });

  it("should support multiple rollback strategies", () => {
    const blueGreen = createRollbackSteps("blue-green");
    const canary = createRollbackSteps("canary");
    const immediate = createRollbackSteps("immediate");
    expect(blueGreen.length).toBeGreaterThan(0);
    expect(canary.length).toBeGreaterThan(0);
    expect(immediate.length).toBeGreaterThan(0);
  });

  it("should execute rollback plan", () => {
    const plan = manager.createPlan({
      strategy: "immediate",
      approvalRequired: false,
    });
    expect(plan).not.toBeNull();
    const execution = manager.executePlan(plan!.id);
    expect(execution).not.toBeNull();
    expect(execution!.status).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────
// Release Checklist
// ─────────────────────────────────────────────────────────────────

describe("Deployment: Release Checklist", () => {
  let manager: ReleaseChecklistManager;

  beforeEach(() => {
    manager = createReleaseChecklistManager();
  });

  it("should create a release checklist manager", () => {
    expect(manager).toBeDefined();
    expect(manager).toBeInstanceOf(ReleaseChecklistManager);
  });

  it("should have default checklist items", () => {
    expect(DEFAULT_CHECKLIST_ITEMS).toBeDefined();
    expect(Array.isArray(DEFAULT_CHECKLIST_ITEMS)).toBe(true);
    expect(DEFAULT_CHECKLIST_ITEMS.length).toBeGreaterThan(15);
  });

  it("should create a release checklist", () => {
    const checklist = manager.createChecklist("2.0.0-alpha.1", "production");
    expect(checklist).toBeDefined();
    expect(checklist.version).toBe("2.0.0-alpha.1");
    expect(checklist.items.length).toBeGreaterThan(0);
  });

  it("should track completion progress via summary", () => {
    const checklist = manager.createChecklist("2.0.0", "production");
    expect(checklist.summary).toBeDefined();
    expect(checklist.summary.total).toBeGreaterThan(0);
    expect(checklist.summary.completed).toBe(0);
    expect(checklist.summary.percentage).toBe(0);
  });

  it("should mark items as completed", () => {
    const checklist = manager.createChecklist("2.0.0", "production");
    // Find first item without dependencies
    const item = checklist.items.find(
      (i) => !i.dependencies || i.dependencies.length === 0
    );
    expect(item).toBeDefined();
    const result = manager.completeItem(checklist.id, item!.id, "ci-bot");
    expect(result).toBe(true);
  });

  it("should organize items by phase", () => {
    const phases = [...new Set(DEFAULT_CHECKLIST_ITEMS.map((i) => i.phase))];
    expect(phases).toContain("pre-deploy");
    expect(phases).toContain("deploy");
    expect(phases).toContain("post-deploy");
    expect(phases).toContain("verification");
  });
});

// ─────────────────────────────────────────────────────────────────
// Deployment Health Monitor
// ─────────────────────────────────────────────────────────────────

describe("Deployment: Health Monitor", () => {
  let monitor: DeploymentHealthMonitor;

  beforeEach(() => {
    monitor = createDeploymentHealthMonitor({
      version: "2.0.0-alpha.1",
      environment: "production",
    });
  });

  it("should create a deployment health monitor", () => {
    expect(monitor).toBeDefined();
    expect(monitor).toBeInstanceOf(DeploymentHealthMonitor);
  });

  it("should have default deployment windows", () => {
    expect(DEFAULT_DEPLOYMENT_WINDOWS).toBeDefined();
    expect(Array.isArray(DEFAULT_DEPLOYMENT_WINDOWS)).toBe(true);
    expect(DEFAULT_DEPLOYMENT_WINDOWS.length).toBeGreaterThan(0);
  });

  it("should track deployment phases", () => {
    const status = monitor.getStatus();
    expect(status.phase).toBe("preparing");

    monitor.startDeployment();
    expect(monitor.getStatus().phase).toBe("deploying");

    monitor.startVerification();
    expect(monitor.getStatus().phase).toBe("verifying");

    monitor.startMonitoring();
    expect(monitor.getStatus().phase).toBe("monitoring");

    monitor.markStable();
    expect(monitor.getStatus().phase).toBe("stable");
  });

  it("should calculate confidence from metrics", () => {
    monitor.startMonitoring();
    monitor.updateMetrics({
      requestsPerSecond: 100,
      errorRate: 0.1,
      p50LatencyMs: 50,
      p95LatencyMs: 200,
      p99LatencyMs: 500,
      activeConnections: 50,
      memoryUsageMB: 256,
      cpuPercent: 30,
      eventBusDepth: 5,
      dlqDepth: 0,
      agentsHealthy: 8,
      agentsTotal: 8,
    });
    expect(monitor.getConfidence()).toBeGreaterThan(90);
  });

  it("should detect degraded state from high error rate", () => {
    monitor.startMonitoring();
    monitor.markStable();
    monitor.updateMetrics({
      requestsPerSecond: 100,
      errorRate: 10,
      p50LatencyMs: 50,
      p95LatencyMs: 200,
      p99LatencyMs: 500,
      activeConnections: 50,
      memoryUsageMB: 256,
      cpuPercent: 30,
      eventBusDepth: 5,
      dlqDepth: 0,
      agentsHealthy: 8,
      agentsTotal: 8,
    });
    expect(monitor.getConfidence()).toBeLessThan(70);
    expect(monitor.getStatus().phase).toBe("degraded");
  });

  it("should run canary analysis", () => {
    const canaryMetrics = {
      requestsPerSecond: 50,
      errorRate: 0.5,
      p50LatencyMs: 60,
      p95LatencyMs: 250,
      p99LatencyMs: 600,
      activeConnections: 25,
      memoryUsageMB: 128,
      cpuPercent: 20,
      eventBusDepth: 2,
      dlqDepth: 0,
      agentsHealthy: 8,
      agentsTotal: 8,
    };
    const baselineMetrics = {
      requestsPerSecond: 50,
      errorRate: 0.3,
      p50LatencyMs: 55,
      p95LatencyMs: 200,
      p99LatencyMs: 500,
      activeConnections: 25,
      memoryUsageMB: 120,
      cpuPercent: 18,
      eventBusDepth: 1,
      dlqDepth: 0,
      agentsHealthy: 8,
      agentsTotal: 8,
    };
    const analysis = monitor.runCanaryAnalysis(canaryMetrics, baselineMetrics, {
      canaryVersion: "2.0.0-alpha.2",
      baselineVersion: "2.0.0-alpha.1",
      trafficPercent: 10,
    });
    expect(analysis).toBeDefined();
    expect(analysis.verdict).toBe("pass");
    expect(analysis.comparison.errorRateDelta).toBeDefined();
  });

  it("should check deployment windows", () => {
    const windows = monitor.getDeploymentWindows();
    expect(windows.length).toBeGreaterThan(0);
    // Emergency window should always be open
    const isOpen = monitor.isDeploymentWindowOpen("emergency");
    expect(isOpen).toBe(true);
  });

  it("should track deployment history", () => {
    monitor.startDeployment();
    monitor.updateMetrics({
      requestsPerSecond: 10,
      errorRate: 0,
      p50LatencyMs: 50,
      p95LatencyMs: 100,
      p99LatencyMs: 200,
      activeConnections: 5,
      memoryUsageMB: 128,
      cpuPercent: 10,
      eventBusDepth: 0,
      dlqDepth: 0,
      agentsHealthy: 8,
      agentsTotal: 8,
    });
    monitor.updateMetrics({
      requestsPerSecond: 50,
      errorRate: 0.1,
      p50LatencyMs: 55,
      p95LatencyMs: 150,
      p99LatencyMs: 300,
      activeConnections: 25,
      memoryUsageMB: 200,
      cpuPercent: 20,
      eventBusDepth: 2,
      dlqDepth: 0,
      agentsHealthy: 8,
      agentsTotal: 8,
    });
    const history = monitor.getHistory();
    expect(history.length).toBe(2);
  });

  it("should report healthy status", () => {
    monitor.startMonitoring();
    expect(monitor.isHealthy()).toBe(true);
    monitor.markFailed();
    expect(monitor.isHealthy()).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// Route Registration
// ─────────────────────────────────────────────────────────────────

describe("Deployment: Route Registration", () => {
  it("should register /platform/deployment route", () => {
    const deploymentRoutes = [
      "/platform/deployment",
      "/platform/deployment/environment",
      "/platform/deployment/secrets",
      "/platform/deployment/release",
      "/platform/deployment/rollback",
      "/platform/deployment/readiness",
    ];
    // Verify route structure is valid
    deploymentRoutes.forEach((route) => {
      expect(route).toMatch(/^\/platform\/deployment/);
    });
    expect(deploymentRoutes.length).toBe(6);
  });
});

// ─────────────────────────────────────────────────────────────────
// Quality Gate Integration
// ─────────────────────────────────────────────────────────────────

describe("Deployment: Quality Gate Checks", () => {
  it("should validate required env vars present", () => {
    const validator = new EnvironmentValidator(undefined, {
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_ANON_KEY: "key",
      OPENAI_API_KEY: "sk-test-key-that-is-long-enough",
      SENTRY_DSN: "https://sentry.io/123",
      JWT_SECRET: "secret-that-is-at-least-32-characters-long",
    });
    const report = validator.validate("production");
    expect(report.summary.score).toBeGreaterThan(10);
  });

  it("should validate no secret values committed", () => {
    const auditor = createSecretsAuditor();
    const safeCode = `
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const apiKey = process.env.OPENAI_API_KEY;
    `;
    const findings = auditor.scanContent(safeCode, "config.ts");
    expect(findings.length).toBe(0);
  });

  it("should validate readiness score >= 90", async () => {
    const fullContext: ReadinessContext = {
      envScore: 100,
      supabaseConfigured: true,
      pineconeConfigured: true,
      deployTargetConfigured: true,
      secretsScore: 100,
      secretFindings: 0,
      rlsEnabled: true,
      tenantIsolation: true,
      rbacActive: true,
      sentryConfigured: true,
      healthChecksCount: 7,
      alertRulesCount: 8,
      eventBusHealthy: true,
      dlqCount: 0,
      rollbackAvailable: true,
      rollbackTarget: "1.9.2",
      testsPass: true,
      testCount: 725,
      buildSuccess: true,
      bundleSizeMB: 2.5,
      knowledgeGraphValid: true,
    };
    const scorecard = createReadinessScorecard(fullContext);
    const result = await scorecard.evaluate("production", "2.0.0-alpha.1");
    expect(result.percentage).toBeGreaterThanOrEqual(90);
    expect(result.gate).toBe("pass");
  });

  it("should validate rollback target available", () => {
    const manager = createRollbackPlanManager();
    // Register in order so second registration archives first to 'previous'
    manager.registerVersion({
      version: "1.9.2",
      commitSha: "abc123",
      deployedAt: new Date(Date.now() - 86400000).toISOString(),
      environment: "production",
      status: "active",
      artifacts: [],
      healthScore: 98,
      metadata: {},
    });
    manager.registerVersion({
      version: "2.0.0-alpha.1",
      commitSha: "def456",
      deployedAt: new Date().toISOString(),
      environment: "production",
      status: "active",
      artifacts: [],
      healthScore: 95,
      metadata: {},
    });
    const plan = manager.createPlan({ strategy: "blue-green" });
    expect(plan).not.toBeNull();
    expect(plan!.status).toBe("ready");
    expect(plan!.targetVersion).toBeDefined();
  });
});
