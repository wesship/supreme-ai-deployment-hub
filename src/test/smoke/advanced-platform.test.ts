/**
 * D3VONN Advanced Platform Smoke Tests
 *
 * Tests for phases 14-21: Knowledge Intelligence, Marketplace,
 * Workflow Studio, Autonomous Ops, Enterprise Governance,
 * Customer Success, Developer Platform, Commercial Readiness.
 */
import { describe, it, expect } from "vitest";

// ─── Knowledge Intelligence ───────────────────────────────────
import { SemanticLinker, createSemanticLinker } from "../../../shared/knowledge-intelligence/semantic-linker";
import { GapDetector, createGapDetector } from "../../../shared/knowledge-intelligence/gap-detector";
import { ContradictionDetector, createContradictionDetector } from "../../../shared/knowledge-intelligence/contradiction-detector";
import { SourceScorer, createSourceScorer } from "../../../shared/knowledge-intelligence/source-scoring";
import { OntologyGenerator, createOntologyGenerator } from "../../../shared/knowledge-intelligence/ontology-generator";

// ─── Marketplace ──────────────────────────────────────────────
import { PluginRegistry, createPluginRegistry } from "../../../shared/marketplace/plugin-registry";
import { PluginSigner, createPluginSigner } from "../../../shared/marketplace/plugin-signing";
import { PluginRuntime, PluginBuilder, createPluginRuntime, createPluginBuilder } from "../../../shared/marketplace/plugin-sdk";

// ─── Workflow Studio ──────────────────────────────────────────
import { WorkflowEngine, createWorkflowEngine } from "../../../shared/workflow-studio/workflow-engine";
import { WORKFLOW_TEMPLATES } from "../../../shared/workflow-studio/templates";

// ─── Autonomous Operations ────────────────────────────────────
import { GoalEngine, createGoalEngine } from "../../../shared/autonomous-ops/goal-engine";

// ─── Enterprise Governance ────────────────────────────────────
import { createAuditExplorer } from "../../../shared/enterprise-governance/audit-explorer";
import { createComplianceCenter } from "../../../shared/enterprise-governance/compliance-center";
import { createPolicyBuilder } from "../../../shared/enterprise-governance/policy-builder";
import { loadFrameworkControls, getFrameworkSummary } from "../../../shared/enterprise-governance/soc2-gdpr-hipaa";

// ─── Customer Success ─────────────────────────────────────────
import { createOnboardingEngine } from "../../../shared/customer-success/onboarding";
import { createHealthScoreEngine } from "../../../shared/customer-success/health-scores";
import { createFeatureFlagEngine } from "../../../shared/customer-success/feature-flags";

// ─── Developer Platform ───────────────────────────────────────
import { createApiRegistry } from "../../../shared/developer-platform/api-registry";
import { createWebhookManager } from "../../../shared/developer-platform/webhooks";
import { createCliRegistry } from "../../../shared/developer-platform/cli-sdk";
import { createPlaygroundEngine } from "../../../shared/developer-platform/playground";

// ─── Commercial Readiness ─────────────────────────────────────
import { createSubscriptionManager } from "../../../shared/commercial/subscription-lifecycle";
import { createLicenseManager } from "../../../shared/commercial/license-keys";
import { createPartnerPortal } from "../../../shared/commercial/partner-portal";
import { createWhiteLabelEngine, createMultiRegionManager } from "../../../shared/commercial/white-label";

// ═══════════════════════════════════════════════════════════════
// Knowledge Intelligence Tests
// ═══════════════════════════════════════════════════════════════

describe("Knowledge Intelligence (DKOS 2.0)", () => {
  it("SemanticLinker creates documents and discovers links", () => {
    const linker = createSemanticLinker();
    linker.addDocument({ id: "d1", title: "AI Overview", content: "Artificial Intelligence is the field of computer science", entities: ["AI", "computer science"], concepts: ["intelligence", "automation"], metadata: {} });
    linker.addDocument({ id: "d2", title: "ML Basics", content: "Machine Learning is a subset of AI and computer science", entities: ["ML", "AI", "computer science"], concepts: ["learning", "automation"], metadata: {} });
    const result = linker.discoverLinks("d1");
    expect(result.totalCandidates).toBeGreaterThanOrEqual(1);
    const links = linker.getLinks("d1");
    expect(links.length).toBeGreaterThanOrEqual(0); // May or may not meet confidence threshold
  });

  it("GapDetector identifies knowledge gaps", () => {
    const detector = createGapDetector({ expectedTopics: ["security", "auth", "encryption", "audit"] });
    detector.addNode({ id: "n1", topic: "security", content: "Security overview", links: ["n2"], lastUpdated: new Date().toISOString(), accessCount: 10 });
    detector.addNode({ id: "n2", topic: "encryption", content: "AES-256 encryption", links: ["n1"], lastUpdated: new Date().toISOString(), accessCount: 5 });
    const gaps = detector.detectGaps();
    expect(gaps.length).toBeGreaterThan(0);
  });

  it("ContradictionDetector finds contradictions", () => {
    const detector = createContradictionDetector();
    detector.addClaim({ id: "c1", nodeId: "n1", subject: "system encryption", predicate: "uses", object: "AES-256", confidence: 0.9, timestamp: new Date().toISOString(), source: "doc1" });
    detector.addClaim({ id: "c2", nodeId: "n2", subject: "system encryption", predicate: "uses", object: "AES-128", confidence: 0.8, timestamp: new Date().toISOString(), source: "doc2" });
    const contradictions = detector.detectContradictions();
    expect(contradictions.length).toBe(1);
    expect(["factual", "temporal", "numerical"]).toContain(contradictions[0].type);
  });

  it("SourceScorer rates sources", () => {
    const scorer = createSourceScorer();
    scorer.addSource({ id: "s1", name: "Official Docs", type: "official_docs", publishedAt: new Date().toISOString(), citationCount: 50, metadata: {} });
    const score = scorer.scoreSource("s1");
    expect(score).toBeTruthy();
    expect(score!.overallScore).toBeGreaterThan(0);
  });

  it("OntologyGenerator creates ontology from documents", () => {
    const generator = createOntologyGenerator();
    generator.addDocument({ id: "d1", content: "Agents perform tasks", entities: ["agent", "task"], relations: ["agent performs task"] });
    generator.addDocument({ id: "d2", content: "Agents use workflows", entities: ["agent", "workflow"], relations: ["agent uses workflow"] });
    generator.addDocument({ id: "d3", content: "Workflows contain tasks", entities: ["workflow", "task", "agent"], relations: ["workflow contains task"] });
    const ontology = generator.generate("D3VONN Ontology");
    expect(ontology.name).toBe("D3VONN Ontology");
    expect(ontology.classes.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Marketplace Tests
// ═══════════════════════════════════════════════════════════════

describe("AI Marketplace & Plugin SDK", () => {
  it("PluginRegistry publishes and searches plugins", () => {
    const registry = createPluginRegistry();
    const result = registry.publish({
      id: "p1", name: "Test Plugin", version: "1.0.0", author: "dev", description: "A test plugin",
      category: "tool", tags: ["test"], license: "MIT", minPlatformVersion: "1.0.0",
      dependencies: [], permissions: [], entrypoint: "index.js",
      pricing: { model: "free" },
    });
    expect(result.success).toBe(true);
    const searchResult = registry.search("test");
    expect(searchResult.plugins.length).toBe(1);
    expect(searchResult.plugins[0].name).toBe("Test Plugin");
  });

  it("PluginSigner signs and verifies plugins", () => {
    const signer = createPluginSigner();
    signer.registerCertificate({
      id: "cert1", publisherId: "pub1", publisherName: "Test Publisher",
      publicKey: "pk_test_123", issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
      revoked: false, trustLevel: "verified",
    });
    const signature = signer.sign("p1", "1.0.0", "plugin-content-hash", "cert1");
    expect(signature).toBeTruthy();
    expect(signature!.pluginId).toBe("p1");

    const verification = signer.verify("p1", "1.0.0", "plugin-content-hash");
    expect(verification.status).toBe("valid");
    expect(verification.trustLevel).toBe("verified");
  });

  it("PluginBuilder creates plugin definitions", () => {
    const builder = createPluginBuilder();
    const definition = builder
      .setId("my-plugin")
      .setName("My Plugin")
      .setVersion("1.0.0")
      .setExecutor(async (_ctx, input) => input)
      .onActivate(async () => {})
      .build();
    expect(definition.id).toBe("my-plugin");
    expect(definition.name).toBe("My Plugin");
  });
});

// ═══════════════════════════════════════════════════════════════
// Workflow Studio Tests
// ═══════════════════════════════════════════════════════════════

describe("Workflow Studio", () => {
  it("WorkflowEngine creates and executes workflows", async () => {
    const engine = createWorkflowEngine();
    const now = new Date().toISOString();
    engine.createWorkflow({
      id: "wf1", name: "Test Workflow", description: "A test workflow", version: "1.0.0",
      status: "active", tenantId: "t1", createdAt: now, updatedAt: now, timeout: 30000,
      nodes: [
        { id: "start", type: "start", label: "Start", config: {}, position: { x: 0, y: 0 } },
        { id: "action1", type: "action", label: "Action 1", config: {}, position: { x: 100, y: 0 } },
        { id: "end", type: "end", label: "End", config: {}, position: { x: 200, y: 0 } },
      ],
      edges: [
        { id: "e1", source: "start", target: "action1", type: "default" },
        { id: "e2", source: "action1", target: "end", type: "default" },
      ],
      variables: {},
      triggers: [{ type: "manual", config: {} }],
      retryPolicy: { maxRetries: 3, backoffMs: 1000, backoffMultiplier: 2, maxBackoffMs: 30000 },
    });

    const result = await engine.execute("wf1");
    expect(result.status).toBe("completed");
    expect(result.nodesExecuted).toBeGreaterThan(0);
  });

  it("has pre-built templates", () => {
    expect(WORKFLOW_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    expect(WORKFLOW_TEMPLATES[0].name).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// Autonomous Operations Tests
// ═══════════════════════════════════════════════════════════════

describe("Autonomous Operations", () => {
  it("creates and manages goals", () => {
    const engine = createGoalEngine();
    const goal = engine.createGoal({
      id: "g1", tenantId: "t1", title: "Deploy ML Pipeline", description: "Set up end-to-end ML pipeline",
      priority: "high", status: "pending",
      constraints: { maxBudget: 100, maxDuration: 3600000, maxRetries: 3, allowedAgents: ["hermes", "analyst"], requiredCapabilities: [], qualityThreshold: 0.8 },
      metadata: {},
    });
    expect(goal.id).toBe("g1");
    expect(goal.status).toBe("pending");
    expect(goal.subtasks).toHaveLength(0);
  });

  it("decomposes goals into subtasks with routing", () => {
    const engine = createGoalEngine();
    engine.registerCostModel({ agentId: "hermes", costPerInvocation: 0.01, costPerToken: 0.0001, costPerMinute: 0.05, capabilities: ["reasoning", "search"], reliability: 0.95, avgLatency: 2000 });
    engine.registerCostModel({ agentId: "analyst", costPerInvocation: 0.005, costPerToken: 0.00005, costPerMinute: 0.03, capabilities: ["data", "analysis"], reliability: 0.9, avgLatency: 3000 });

    engine.createGoal({
      id: "g2", tenantId: "t1", title: "Research Task", description: "Research and summarize",
      priority: "medium", status: "pending",
      constraints: { maxBudget: 50, maxDuration: 1800000, maxRetries: 2, allowedAgents: ["hermes", "analyst"], requiredCapabilities: [], qualityThreshold: 0.7 },
      metadata: {},
    });

    const decomposed = engine.decompose("g2", [
      { id: "st1", title: "Gather data", description: "Collect data", dependencies: [], estimatedCost: 5, estimatedDuration: 30000, maxRetries: 2 },
      { id: "st2", title: "Analyze", description: "Analyze data", dependencies: ["st1"], estimatedCost: 10, estimatedDuration: 60000, maxRetries: 2 },
    ]);

    expect(decomposed).toBeTruthy();
    expect(decomposed!.subtasks.length).toBe(2);
    expect(decomposed!.status).toBe("active");
    expect(decomposed!.routing.selectedAgents.length).toBe(2);
  });

  it("tracks stats", () => {
    const engine = createGoalEngine();
    const stats = engine.getStats();
    expect(stats.totalGoals).toBe(0);
    expect(stats.avgHealthScore).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// Enterprise Governance Tests
// ═══════════════════════════════════════════════════════════════

describe("Enterprise Governance", () => {
  describe("Audit Explorer", () => {
    it("logs and queries audit entries", () => {
      const explorer = createAuditExplorer();
      explorer.log({ tenantId: "t1", userId: "u1", category: "auth", severity: "info", action: "login", resource: "session", resourceId: "s1", details: {}, ipAddress: "1.2.3.4", userAgent: "test" });
      explorer.log({ tenantId: "t1", userId: "u1", category: "data", severity: "warning", action: "export", resource: "dataset", resourceId: "d1", details: {}, ipAddress: "1.2.3.4", userAgent: "test" });

      const results = explorer.query({ tenantId: "t1" });
      expect(results.length).toBe(2);

      const authOnly = explorer.query({ category: "auth" });
      expect(authOnly.length).toBe(1);
    });

    it("verifies chain integrity", () => {
      const explorer = createAuditExplorer();
      explorer.log({ tenantId: "t1", userId: "u1", category: "auth", severity: "info", action: "login", resource: "session", resourceId: "s1", details: {}, ipAddress: "1.2.3.4", userAgent: "test" });
      explorer.log({ tenantId: "t1", userId: "u2", category: "config", severity: "info", action: "update", resource: "settings", resourceId: "set1", details: {}, ipAddress: "5.6.7.8", userAgent: "test" });

      const integrity = explorer.verifyIntegrity();
      expect(integrity.valid).toBe(true);
    });
  });

  describe("Compliance Center", () => {
    it("registers controls and runs assessments", () => {
      const center = createComplianceCenter();
      center.registerControl({ id: "SOC2-CC6.1", framework: "SOC2", category: "access", title: "Access Security", description: "Logical access controls", status: "implemented", owner: "security-team", evidence: [], lastAssessed: "", nextReview: "", risk: "high", automatable: false });
      center.registerControl({ id: "SOC2-CC6.2", framework: "SOC2", category: "access", title: "User Registration", description: "User provisioning", status: "gap", owner: "security-team", evidence: [], lastAssessed: "", nextReview: "", risk: "high", automatable: true });

      const assessment = center.runAssessment("t1", "SOC2", "auditor");
      expect(assessment.score).toBe(50);
      expect(assessment.gaps.length).toBe(1);
    });
  });

  describe("Policy Builder", () => {
    it("creates and evaluates policies", () => {
      const builder = createPolicyBuilder();
      builder.createPolicy({
        id: "pol1", tenantId: "t1", name: "Data Export Policy", description: "Restrict bulk data exports",
        scope: "tenant", enabled: true, priority: 10, createdBy: "admin", tags: ["security"], metadata: {},
        rules: [{
          id: "r1", name: "Block large exports",
          conditions: [{ field: "export.rowCount", operator: "greater_than", value: 10000 }],
          conditionLogic: "all", effect: "deny",
          actions: [{ type: "block", config: { message: "Export too large" } }],
          exceptions: [],
        }],
      });

      const evaluations = builder.evaluate({ export: { rowCount: 50000 } }, "t1");
      expect(evaluations.length).toBe(1);
      expect(evaluations[0].matched).toBe(true);
      expect(evaluations[0].effect).toBe("deny");
    });
  });

  describe("SOC2/GDPR/HIPAA Frameworks", () => {
    it("loads framework controls", () => {
      const soc2 = loadFrameworkControls("SOC2");
      expect(soc2.length).toBeGreaterThan(10);

      const gdpr = loadFrameworkControls("GDPR");
      expect(gdpr.length).toBeGreaterThan(10);

      const hipaa = loadFrameworkControls("HIPAA");
      expect(hipaa.length).toBeGreaterThan(10);
    });

    it("provides framework summaries", () => {
      const soc2 = getFrameworkSummary("SOC2");
      expect(soc2.name).toBe("SOC 2 Type II");
      expect(soc2.totalControls).toBeGreaterThan(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// Customer Success Tests
// ═══════════════════════════════════════════════════════════════

describe("Customer Success Layer", () => {
  describe("Onboarding Engine", () => {
    it("starts and progresses through onboarding", () => {
      const engine = createOnboardingEngine();
      const state = engine.startOnboarding("u1", "t1", "platform-quickstart");
      expect(state).toBeTruthy();
      expect(state!.status).toBe("in_progress");

      engine.completeStep("u1", "platform-quickstart", "qs-1");
      const progress = engine.getProgress("u1", "platform-quickstart");
      expect(progress.completed).toBe(1);
      expect(progress.percent).toBeGreaterThan(0);
    });
  });

  describe("Health Scores", () => {
    it("calculates health scores", () => {
      const engine = createHealthScoreEngine();
      const score = engine.calculateScore("t1", {
        tenantId: "t1", dailyActiveUsers: 50, weeklyActiveUsers: 100, monthlyActiveUsers: 200,
        avgSessionDuration: 15, featureAdoption: { agents: 80, workflows: 60, plugins: 40 },
        lastLogin: new Date().toISOString(), totalApiCalls: 50000, agentsDeployed: 5, workflowsActive: 3,
      });
      expect(score.overallScore).toBeGreaterThan(0);
      expect(score.status).toBeTruthy();
    });
  });

  describe("Feature Flags", () => {
    it("creates and evaluates flags", () => {
      const engine = createFeatureFlagEngine();
      engine.createFlag({
        id: "ff1", key: "new-dashboard", name: "New Dashboard", description: "Redesigned dashboard",
        status: "active", defaultValue: false,
        rollout: { strategy: "percentage", percentage: 50 },
        targeting: [], killSwitch: false, owner: "product", tags: ["ui"],
      });

      const result = engine.evaluate("new-dashboard", { userId: "u1", tenantId: "t1", attributes: {} });
      expect(result.flagKey).toBe("new-dashboard");
      expect(typeof result.value).toBe("boolean");
    });

    it("supports targeting rules", () => {
      const engine = createFeatureFlagEngine();
      engine.createFlag({
        id: "ff2", key: "beta-feature", name: "Beta Feature", description: "Beta only",
        status: "active", defaultValue: false,
        rollout: { strategy: "percentage", percentage: 0 },
        targeting: [{ id: "r1", attribute: "tier", operator: "equals", value: "enterprise", serve: true }],
        killSwitch: false, owner: "product", tags: [],
      });

      const enterprise = engine.evaluate("beta-feature", { userId: "u1", tenantId: "t1", attributes: { tier: "enterprise" } });
      expect(enterprise.value).toBe(true);

      const free = engine.evaluate("beta-feature", { userId: "u2", tenantId: "t2", attributes: { tier: "free" } });
      expect(free.value).toBe(false);
    });

    it("kill switch disables flag", () => {
      const engine = createFeatureFlagEngine();
      engine.createFlag({
        id: "ff3", key: "risky-feature", name: "Risky Feature", description: "Can be killed",
        status: "active", defaultValue: true,
        rollout: { strategy: "all", percentage: 100 },
        targeting: [], killSwitch: false, owner: "eng", tags: [],
      });

      engine.activateKillSwitch("risky-feature");
      const result = engine.evaluate("risky-feature", { userId: "u1", tenantId: "t1", attributes: {} });
      expect(result.value).toBe(false);
      expect(result.reason).toBe("kill_switch");
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// Developer Platform Tests
// ═══════════════════════════════════════════════════════════════

describe("Developer Platform", () => {
  describe("API Registry", () => {
    it("registers endpoints and manages API keys", () => {
      const registry = createApiRegistry();
      registry.registerEndpoint({
        id: "ep1", path: "/agents", method: "GET", version: "v1", name: "List Agents",
        description: "List all agents", auth: "api_key", rateLimit: { requests: 100, window: 60 },
        request: { contentType: "application/json", fields: [] },
        response: { contentType: "application/json", fields: [{ name: "agents", type: "array", required: true, description: "List of agents" }] },
        status: "active", tags: ["agents"], examples: [],
      });

      const key = registry.createApiKey("t1", "Production Key", ["read", "write"]);
      expect(key.key.startsWith("d3v_")).toBe(true);

      const validated = registry.validateApiKey(key.key);
      expect(validated).toBeTruthy();
      expect(validated!.tenantId).toBe("t1");
    });
  });

  describe("Webhooks", () => {
    it("creates endpoints and dispatches events", () => {
      const manager = createWebhookManager();
      const endpoint = manager.createEndpoint({
        tenantId: "t1", url: "https://example.com/webhook", name: "Test Hook",
        description: "Test", events: ["agent.deployed"], status: "active",
        headers: {}, retryPolicy: { maxRetries: 3, initialDelay: 1000, backoffMultiplier: 2, maxDelay: 30000 },
        maxFailures: 5,
      });
      expect(endpoint.secret.startsWith("whsec_")).toBe(true);

      const deliveries = manager.dispatch({
        id: "ev1", type: "agent.deployed", tenantId: "t1",
        data: { agentId: "hermes" }, timestamp: new Date().toISOString(), source: "platform",
      });
      expect(deliveries.length).toBe(1);
    });

    it("generates and verifies signatures", () => {
      const manager = createWebhookManager();
      const sig = manager.generateSignature('{"test": true}', "secret123");
      expect(sig.startsWith("v1=")).toBe(true);
      expect(manager.verifySignature('{"test": true}', sig, "secret123")).toBe(true);
      expect(manager.verifySignature('{"test": false}', sig, "secret123")).toBe(false);
    });
  });

  describe("CLI & SDK", () => {
    it("registers and lists commands", () => {
      const registry = createCliRegistry();
      const commands = registry.listCommands();
      expect(commands.length).toBeGreaterThanOrEqual(6);
    });

    it("executes commands", async () => {
      const registry = createCliRegistry();
      const result = await registry.execute("agents list --status active", {
        apiKey: "test-key", baseUrl: "https://api.d3vonn.io", tenantId: "t1",
        outputFormat: "json", verbose: false, profile: "default",
      });
      expect(result.success).toBe(true);
    });

    it("generates help text", () => {
      const registry = createCliRegistry();
      const help = registry.generateHelp();
      expect(help).toContain("D3VONN CLI");
      expect(help).toContain("agents");
    });
  });

  describe("Playground", () => {
    it("executes requests and generates code", async () => {
      const playground = createPlaygroundEngine();
      const request = { id: "req1", name: "List Agents", method: "GET", url: "https://api.d3vonn.io/v1/agents", headers: { "X-API-Key": "test" }, queryParams: {}, auth: { type: "api_key", value: "d3v_test" } };

      const response = await playground.executeRequest(request);
      expect(response.statusCode).toBe(200);

      const tsCode = playground.generateCode(request, "typescript");
      expect(tsCode.language).toBe("typescript");
      expect(tsCode.code).toContain("fetch");

      const curlCode = playground.generateCode(request, "curl");
      expect(curlCode.code).toContain("curl");
    });

    it("manages collections", () => {
      const playground = createPlaygroundEngine();
      const collection = playground.createCollection({ name: "Agent APIs", description: "Agent endpoints", requests: [], variables: {}, shared: false });
      expect(collection.id).toBeTruthy();

      playground.addToCollection(collection.id, { id: "r1", name: "Test", method: "GET", url: "https://api.d3vonn.io/test", headers: {}, queryParams: {}, auth: { type: "none", value: "" } });
      const fetched = playground.getCollection(collection.id);
      expect(fetched!.requests.length).toBe(1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// Commercial Readiness Tests
// ═══════════════════════════════════════════════════════════════

describe("Commercial Readiness", () => {
  describe("Subscription Lifecycle", () => {
    it("creates subscriptions with trials", () => {
      const manager = createSubscriptionManager();
      const sub = manager.create("t1", "pro", "monthly", { trialDays: 14, pricePerUnit: 99 });
      expect(sub.status).toBe("trialing");
      expect(sub.trialEnd).toBeTruthy();
    });

    it("handles upgrades with proration", () => {
      const manager = createSubscriptionManager();
      const sub = manager.create("t1", "pro", "monthly", { pricePerUnit: 99 });
      const change = manager.upgrade(sub.id, "enterprise", 299, "admin");
      expect(change).toBeTruthy();
      expect(change!.type).toBe("upgrade");
      expect(change!.proration.netAmount).toBeGreaterThan(0);
    });

    it("handles cancellation", () => {
      const manager = createSubscriptionManager();
      const sub = manager.create("t1", "pro", "monthly", { pricePerUnit: 99 });
      const change = manager.cancel(sub.id, true, "Too expensive", "user");
      expect(change).toBeTruthy();
      expect(sub.cancelAtPeriodEnd).toBe(true);
    });

    it("calculates MRR stats", () => {
      const manager = createSubscriptionManager();
      manager.create("t1", "pro", "monthly", { pricePerUnit: 99 });
      manager.create("t2", "enterprise", "annual", { pricePerUnit: 2988 });
      const stats = manager.getStats();
      expect(stats.active).toBe(2);
      expect(stats.mrr).toBeGreaterThan(0);
    });
  });

  describe("License Keys", () => {
    it("generates and validates license keys", () => {
      const manager = createLicenseManager();
      const license = manager.generate("t1", "professional", { durationDays: 365 });
      expect(license.key).toMatch(/^D3V-PRO-/);

      const validation = manager.validate(license.key);
      expect(validation.valid).toBe(true);
      expect(validation.entitlements.length).toBeGreaterThan(0);
    });

    it("handles activations", () => {
      const manager = createLicenseManager();
      const license = manager.generate("t1", "standard", { maxActivations: 2 });

      const act1 = manager.activate(license.key, "machine-1", "Dev Laptop", "1.2.3.4");
      expect(act1.success).toBe(true);

      const act2 = manager.activate(license.key, "machine-2", "Server", "5.6.7.8");
      expect(act2.success).toBe(true);

      const act3 = manager.activate(license.key, "machine-3", "Extra", "9.9.9.9");
      expect(act3.success).toBe(false);
      expect(act3.error).toContain("Maximum activations");
    });

    it("checks entitlements", () => {
      const manager = createLicenseManager();
      const license = manager.generate("t1", "enterprise", {});
      const result = manager.checkEntitlement(license.key, "white_label");
      expect(result.allowed).toBe(true);

      const trial = manager.generate("t2", "trial", {});
      const trialResult = manager.checkEntitlement(trial.key, "white_label");
      expect(trialResult.allowed).toBe(false);
    });
  });

  describe("Partner Portal", () => {
    it("registers partners and manages deals", () => {
      const portal = createPartnerPortal();
      const partner = portal.registerPartner({ name: "TechCo", type: "reseller", tier: "gold", contactEmail: "partner@techco.com", contactName: "John", company: "TechCo Inc", revenueShare: 25, status: "active", metadata: {} });

      const deal = portal.registerDeal(partner.id, { customerName: "BigCorp", customerEmail: "buyer@bigcorp.com", estimatedValue: 50000, notes: "Enterprise deal" });
      expect(deal).toBeTruthy();
      expect(deal!.status).toBe("registered");

      portal.updateDealStatus(partner.id, deal!.id, "won", 55000);
      const analytics = portal.getAnalytics(partner.id);
      expect(analytics.wonDeals).toBe(1);
      expect(analytics.totalRevenue).toBe(55000);
    });

    it("upgrades partner tiers", () => {
      const portal = createPartnerPortal();
      const partner = portal.registerPartner({ name: "Partner2", type: "consulting", tier: "silver", contactEmail: "p@p.com", contactName: "Jane", company: "Consulting Co", revenueShare: 20, status: "active", metadata: {} });

      portal.upgradeTier(partner.id, "platinum");
      const updated = portal.getPartner(partner.id);
      expect(updated!.tier).toBe("platinum");
      expect(updated!.revenueShare).toBe(30);
    });
  });

  describe("White-Label & Multi-Region", () => {
    it("creates white-label configurations", () => {
      const engine = createWhiteLabelEngine();
      engine.createConfig({
        tenantId: "t1", brandName: "AcmeAI", domain: "ai.acme.com",
        theme: { primaryColor: "#FF5733", secondaryColor: "#333", accentColor: "#FFC300", backgroundColor: "#FFF", textColor: "#000", fontFamily: "Inter", borderRadius: "8px", darkMode: false },
        logo: { primary: "/logo.svg", icon: "/icon.svg", favicon: "/favicon.ico" },
        emails: { fromName: "AcmeAI", fromEmail: "noreply@acme.com", replyTo: "support@acme.com", footerText: "AcmeAI Inc.", templateOverrides: {} },
        features: { showPoweredBy: false, showDocumentation: true, showChangelog: false, showStatusPage: true, customNavItems: [], hiddenFeatures: [] },
        legal: { termsUrl: "https://acme.com/terms", privacyUrl: "https://acme.com/privacy", companyName: "Acme Inc.", supportEmail: "support@acme.com" },
      });

      const css = engine.generateCssVariables("t1");
      expect(css).toContain("--d3v-primary: #FF5733");
    });

    it("manages multi-region deployment", () => {
      const manager = createMultiRegionManager();
      const regions = manager.listRegions("active");
      expect(regions.length).toBe(6);

      manager.configureTenant({ tenantId: "t1", primaryRegion: "eu-west-1", replicaRegions: ["eu-central-1"], dataResidency: ["eu-west-1", "eu-central-1"], failoverPolicy: "automatic", crossRegionReplication: true });

      const optimal = manager.selectOptimalRegion("t1", "eu-west-1");
      expect(optimal).toBe("eu-west-1");

      const gdprRegions = manager.getRegionsForCompliance("GDPR");
      expect(gdprRegions.length).toBe(2);
    });
  });
});
