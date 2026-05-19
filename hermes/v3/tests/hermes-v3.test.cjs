"use strict";
/**
 * hermes/v3/tests/hermes-v3.test.cjs
 *
 * Hermes v3 — Comprehensive Test Suite
 * Run with: node hermes/v3/tests/hermes-v3.test.cjs
 *
 * Covers:
 *   - OPA policy engine (all decision paths)
 *   - PR comment bot (formatting)
 *   - Risk heatmap (scoring and tiers)
 *   - AWS IAM analyzer (all finding types)
 *   - Agent firewall (all tier combinations)
 */

const { evaluateWithOPA, computeRiskScore } = require("../core/opa.cjs");
const { formatComment, buildRiskBar }        = require("../bot/pr-comment.cjs");
const { generateHeatmap, scoreFile, getTier }= require("../heatmap/risk-heatmap.cjs");
const { analyzeIAM }                         = require("../iam/aws-iam.cjs");
const {
  evaluateAgentAction,
  evaluateContextFirewall,
  getAgentTier,
  loadAgentRegistry,
} = require("../firewall/agent-firewall.cjs");

// ---------------------------------------------------------------------------
// Minimal test harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const errors = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    → ${err.message}`);
    errors.push({ name, error: err.message });
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function assertEqual(actual, expected, label = "") {
  if (actual !== expected) {
    throw new Error(`${label}: expected "${expected}", got "${actual}"`);
  }
}

function assertIncludes(str, substr, label = "") {
  if (!str.includes(substr)) {
    throw new Error(`${label}: expected "${str}" to include "${substr}"`);
  }
}

// ---------------------------------------------------------------------------
// Helper: build a clean context object
// ---------------------------------------------------------------------------

function makeContext(overrides = {}) {
  return {
    repo: "wesship/supreme-ai-deployment-hub",
    branch: "feature/test",
    actor: "wesship",
    eventName: "pull_request",
    runId: "test-123",
    sha: "abc12345",
    filesChanged: [],
    fileClassification: { critical: [], high: [], medium: [], low: [] },
    diffSize: 100,
    pr: { number: 42, title: "Test PR", isDraft: false, labels: [], reviewers: [] },
    riskSignals: {
      hasSecrets: false,
      touchesInfra: false,
      touchesIAM: false,
      touchesWorkflows: false,
      touchesDependencies: false,
      largeDiff: false,
      massiveDiff: false,
      fileCount: 1,
      criticalFileCount: 0,
    },
    agentContext: {
      isAgentActor: false,
      agentId: null,
      executionMode: "human",
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// OPA Policy Engine Tests
// ---------------------------------------------------------------------------

console.log("\n=== OPA Policy Engine Tests ===");

test("DENY: direct push to main by human", () => {
  const ctx = makeContext({ branch: "main" });
  const r = evaluateWithOPA(ctx);
  assertEqual(r.decision, "DENY");
  assertEqual(r.policy, "hermes.ci");
  assert(r.remediationSteps.length > 0, "should have remediation steps");
});

test("ALLOW: push to main by github-actions bot", () => {
  const ctx = makeContext({
    branch: "main",
    actor: "github-actions[bot]",
    agentContext: { isAgentActor: true, agentId: "github-actions[bot]", executionMode: "bot" },
  });
  const r = evaluateWithOPA(ctx);
  assertEqual(r.decision, "ALLOW");
});

test("DENY: secrets in diff", () => {
  const ctx = makeContext({ riskSignals: { ...makeContext().riskSignals, hasSecrets: true } });
  const r = evaluateWithOPA(ctx);
  assertEqual(r.decision, "DENY");
  assertEqual(r.policy, "hermes.security");
  assertEqual(r.riskScore, 100);
});

test("DENY: large IAM change", () => {
  const ctx = makeContext({
    riskSignals: { ...makeContext().riskSignals, touchesIAM: true, largeDiff: true },
  });
  const r = evaluateWithOPA(ctx);
  assertEqual(r.decision, "DENY");
  assertEqual(r.policy, "hermes.security");
});

test("DENY: massive diff", () => {
  const ctx = makeContext({
    riskSignals: { ...makeContext().riskSignals, massiveDiff: true },
  });
  const r = evaluateWithOPA(ctx);
  assertEqual(r.decision, "DENY");
});

test("WARN: small IAM change", () => {
  const ctx = makeContext({
    riskSignals: { ...makeContext().riskSignals, touchesIAM: true },
  });
  const r = evaluateWithOPA(ctx);
  assertEqual(r.decision, "WARN");
  assertEqual(r.policy, "hermes.security");
});

test("WARN: infra change", () => {
  const ctx = makeContext({
    riskSignals: { ...makeContext().riskSignals, touchesInfra: true },
  });
  const r = evaluateWithOPA(ctx);
  assertEqual(r.decision, "WARN");
});

test("WARN: workflow change", () => {
  const ctx = makeContext({
    riskSignals: { ...makeContext().riskSignals, touchesWorkflows: true },
  });
  const r = evaluateWithOPA(ctx);
  assertEqual(r.decision, "WARN");
});

test("WARN: dependency change", () => {
  const ctx = makeContext({
    riskSignals: { ...makeContext().riskSignals, touchesDependencies: true },
  });
  const r = evaluateWithOPA(ctx);
  assertEqual(r.decision, "WARN");
});

test("ALLOW: clean feature branch", () => {
  const ctx = makeContext();
  const r = evaluateWithOPA(ctx);
  assertEqual(r.decision, "ALLOW");
  assertEqual(r.riskScore, 0);
});

test("decision includes timestamp and contextSha", () => {
  const ctx = makeContext();
  const r = evaluateWithOPA(ctx);
  assert(r.timestamp, "should have timestamp");
  assertEqual(r.contextSha, "abc12345");
});

test("risk score increases with multiple signals", () => {
  const ctx = makeContext({
    riskSignals: {
      ...makeContext().riskSignals,
      touchesInfra: true,
      touchesWorkflows: true,
      largeDiff: true,
    },
  });
  const score = computeRiskScore(ctx);
  assert(score > 20, `score ${score} should be > 20`);
});

// ---------------------------------------------------------------------------
// PR Comment Bot Tests
// ---------------------------------------------------------------------------

console.log("\n=== PR Comment Bot Tests ===");

test("formatComment produces valid markdown for DENY", () => {
  const decision = {
    decision: "DENY",
    reason: "Secrets detected",
    policy: "hermes.security",
    severity: "critical",
    remediationSteps: ["Remove the secret", "Rotate credentials"],
    riskScore: 100,
  };
  const ctx = makeContext({ filesChanged: ["src/app.ts"] });
  const comment = formatComment(decision, ctx);
  assertIncludes(comment, "DENY");
  assertIncludes(comment, "Secrets detected");
  assertIncludes(comment, "hermes.security");
  assertIncludes(comment, "Remove the secret");
  assertIncludes(comment, "Remediation Steps");
});

test("formatComment produces valid markdown for ALLOW", () => {
  const decision = {
    decision: "ALLOW",
    reason: "All policy checks passed",
    policy: "hermes.main",
    severity: "info",
    remediationSteps: [],
    riskScore: 0,
  };
  const ctx = makeContext();
  const comment = formatComment(decision, ctx);
  assertIncludes(comment, "ALLOW");
  assertIncludes(comment, "All policy checks passed");
});

test("buildRiskBar produces correct length", () => {
  const bar = buildRiskBar(50);
  assert(bar.includes("█"), "should have filled blocks");
  assert(bar.includes("░"), "should have empty blocks");
});

test("buildRiskBar for 0 is all empty", () => {
  const bar = buildRiskBar(0);
  assert(!bar.includes("█"), "should have no filled blocks");
});

test("buildRiskBar for 100 is all filled", () => {
  const bar = buildRiskBar(100);
  assert(!bar.includes("░"), "should have no empty blocks");
});

// ---------------------------------------------------------------------------
// Risk Heatmap Tests
// ---------------------------------------------------------------------------

console.log("\n=== Risk Heatmap Tests ===");

test("workflow file scores critical", () => {
  const score = scoreFile(".github/workflows/deploy.yml", "");
  assert(score >= 80, `score ${score} should be >= 80`);
  assertEqual(getTier(score), "critical");
});

test("terraform file scores high", () => {
  const score = scoreFile("terraform/main.tf", "");
  assert(score >= 60, `score ${score} should be >= 60`);
  assertEqual(getTier(score), "high");
});

test("package.json scores medium", () => {
  const score = scoreFile("package.json", "");
  assert(score >= 40 && score < 60, `score ${score} should be 40-59`);
  assertEqual(getTier(score), "medium");
});

test("README.md scores low", () => {
  const score = scoreFile("README.md", "");
  assert(score < 40, `score ${score} should be < 40`);
  assertEqual(getTier(score), "low");
});

test("generateHeatmap returns correct summary", () => {
  const ctx = makeContext({
    filesChanged: [
      ".github/workflows/deploy.yml",
      "terraform/main.tf",
      "src/app.ts",
      "README.md",
    ],
  });
  const { summary, entries } = generateHeatmap(ctx);
  assertEqual(entries.length, 4, "entries count");
  assert(summary.critical >= 1, "should have critical files");
  assert(summary.overallRisk > 0, "overall risk should be > 0");
});

test("generateHeatmap markdownTable is non-empty", () => {
  const ctx = makeContext({ filesChanged: ["src/app.ts"] });
  const { markdownTable } = generateHeatmap(ctx);
  assertIncludes(markdownTable, "Risk Heatmap");
  assertIncludes(markdownTable, "src/app.ts");
});

// ---------------------------------------------------------------------------
// AWS IAM Analyzer Tests
// ---------------------------------------------------------------------------

console.log("\n=== AWS IAM Analyzer Tests ===");

test("detects privilege escalation actions", () => {
  const diff = '+  "Action": ["iam:CreateRole", "iam:AttachRolePolicy"]';
  const result = analyzeIAM(diff, ["terraform/iam.tf"]);
  assert(result.hasIAMChanges, "should detect IAM changes");
  assert(result.findings.some((f) => f.type === "privilege_escalation"), "should find escalation");
  assertEqual(result.riskLevel, "critical");
});

test("detects wildcard resource grant", () => {
  const diff = '+"Resource": "*"';
  const result = analyzeIAM(diff, ["terraform/policy.tf"]);
  assert(result.findings.some((f) => f.type === "wildcard_resource"), "should find wildcard");
});

test("detects dangerous managed policy", () => {
  const diff = "+AdministratorAccess";
  const result = analyzeIAM(diff, ["terraform/iam.tf"]);
  assert(result.findings.some((f) => f.type === "dangerous_managed_policy"), "should find admin policy");
});

test("detects IAM user creation", () => {
  const diff = '+resource "aws_iam_user" "my_user" {}';
  const result = analyzeIAM(diff, ["terraform/users.tf"]);
  assert(result.findings.some((f) => f.type === "iam_user_creation"), "should find user creation");
});

test("clean IAM diff returns low risk", () => {
  const diff = '+resource "aws_iam_role" "app_role" { assume_role_policy = data.aws_iam_policy_document.assume.json }';
  const result = analyzeIAM(diff, ["terraform/roles.tf"]);
  assert(result.hasIAMChanges, "should detect IAM");
  assertEqual(result.riskLevel, "low");
});

test("non-IAM files return no findings", () => {
  const result = analyzeIAM("const x = 1;", ["src/app.ts"]);
  assert(!result.hasIAMChanges, "should not detect IAM");
});

// ---------------------------------------------------------------------------
// Agent Firewall Tests
// ---------------------------------------------------------------------------

console.log("\n=== Agent Firewall Tests ===");

test("read-only agent cannot merge PR", () => {
  const result = evaluateAgentAction(
    { agentId: "devonn-security-bot", isAgentActor: true },
    "merge_pr"
  );
  assert(!result.permitted, "should not be permitted");
  assertEqual(result.requiredTier, "operator");
});

test("contributor agent can open PR", () => {
  const result = evaluateAgentAction(
    { agentId: "devonn-copilot", isAgentActor: true },
    "open_pr"
  );
  assert(result.permitted, "should be permitted");
});

test("deployer agent can deploy to staging", () => {
  const result = evaluateAgentAction(
    { agentId: "devonn-deployer", isAgentActor: true },
    "deploy_staging"
  );
  assert(result.permitted, "should be permitted");
});

test("deployer agent cannot deploy to production", () => {
  const result = evaluateAgentAction(
    { agentId: "devonn-deployer", isAgentActor: true },
    "deploy_production"
  );
  assert(!result.permitted, "should not be permitted");
});

test("unknown agent gets read-only tier", () => {
  const registry = loadAgentRegistry();
  const tier = getAgentTier("some-unknown-bot", registry);
  assertEqual(tier, "read-only");
});

test("firewall does not apply to human actors", () => {
  const ctx = makeContext({
    agentContext: { isAgentActor: false, agentId: null, executionMode: "human" },
  });
  const result = evaluateContextFirewall(ctx);
  assert(!result.blocked, "should not be blocked");
  assert(!result.isAgentActor, "should not be agent actor");
});

test("agent firewall blocks IAM modification by contributor", () => {
  const ctx = makeContext({
    actor: "devonn-copilot",
    agentContext: { isAgentActor: true, agentId: "devonn-copilot", executionMode: "bot" },
    riskSignals: { ...makeContext().riskSignals, touchesIAM: true },
  });
  const result = evaluateContextFirewall(ctx);
  assert(result.isAgentActor, "should be agent actor");
  assert(result.blocked, "should be blocked — contributor cannot modify IAM");
});

test("github-actions bot can modify workflows", () => {
  const ctx = makeContext({
    actor: "github-actions[bot]",
    agentContext: { isAgentActor: true, agentId: "github-actions[bot]", executionMode: "bot" },
    riskSignals: { ...makeContext().riskSignals, touchesWorkflows: true },
  });
  const result = evaluateContextFirewall(ctx);
  assert(!result.blocked, "github-actions bot should be permitted to modify workflows");
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${"─".repeat(52)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.error("\nFailed tests:");
  errors.forEach(({ name, error }) => console.error(`  ✗ ${name}: ${error}`));
}
console.log(`${"─".repeat(52)}\n`);

process.exit(failed > 0 ? 1 : 0);
