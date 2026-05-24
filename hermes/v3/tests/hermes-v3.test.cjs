"use strict";
/**
 * hermes/v3/tests/hermes-v3.test.cjs
 *
 * Hermes v3 — Comprehensive Test Suite
 * Run with: node hermes/v3/tests/hermes-v3.test.cjs
 */

const { evaluateWithOPA, computeRiskScore } = require("../core/opa.cjs");
const { formatComment, buildRiskBar } = require("../bot/pr-comment.cjs");
const { generateHeatmap, scoreFile, getTier } = require("../heatmap/risk-heatmap.cjs");
const { analyzeIAM } = require("../iam/aws-iam.cjs");
const {
  evaluateAgentAction,
  evaluateContextFirewall,
  getAgentTier,
  loadAgentRegistry,
} = require("../firewall/agent-firewall.cjs");

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
      hasIAMCritical: false,
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

test("DENY: high-risk large IAM change", () => {
  const ctx = makeContext({
    riskSignals: {
      ...makeContext().riskSignals,
      touchesIAM: true,
      largeDiff: true,
      hasIAMCritical: true,
    },
  });
  const r = evaluateWithOPA(ctx);
  assertEqual(r.decision, "DENY");
  assertEqual(r.policy, "hermes.security");
});

test("WARN: low-risk large IAM reference", () => {
  const ctx = makeContext({
    riskSignals: { ...makeContext().riskSignals, touchesIAM: true, largeDiff: true },
  });
  const r = evaluateWithOPA(ctx);
  assertEqual(r.decision, "WARN");
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

test("ALLOW: bootstrap PR (hermes-only files)", () => {
  const ctx = makeContext({ filesChanged: ["hermes/v3/core/opa.cjs", "docs/HERMES.md"] });
  const r = evaluateWithOPA(ctx);
  assertEqual(r.decision, "ALLOW");
});

test("decision includes timestamp and contextSha", () => {
  const r = evaluateWithOPA(makeContext());
  assert(r.timestamp, "timestamp exists");
  assertEqual(r.contextSha, "abc12345");
});

test("risk score increases with multiple signals", () => {
  const score = computeRiskScore(makeContext({
    riskSignals: {
      ...makeContext().riskSignals,
      touchesIAM: true,
      touchesInfra: true,
      touchesWorkflows: true,
    },
  }));
  assert(score > 0, "score should be positive");
});

console.log("\n=== PR Comment Bot Tests ===");

test("formatComment produces valid markdown for DENY", () => {
  const comment = formatComment({
    decision: "DENY",
    reason: "blocked",
    policy: "hermes.security",
    severity: "critical",
    remediationSteps: ["fix it"],
    riskScore: 90,
  });
  assertIncludes(comment, "DENY");
  assertIncludes(comment, "blocked");
});

test("formatComment produces valid markdown for ALLOW", () => {
  const comment = formatComment({ decision: "ALLOW", reason: "ok", policy: "hermes.main", severity: "info", riskScore: 0, remediationSteps: [] });
  assertIncludes(comment, "ALLOW");
});

test("buildRiskBar produces correct length", () => {
  assertEqual(buildRiskBar(50).length, 10);
});

test("buildRiskBar for 0 is all empty", () => {
  assertEqual(buildRiskBar(0), "░░░░░░░░░░");
});

test("buildRiskBar for 100 is all filled", () => {
  assertEqual(buildRiskBar(100), "██████████");
});

console.log("\n=== Risk Heatmap Tests ===");

test("workflow file scores critical", () => assertEqual(getTier(scoreFile(".github/workflows/ci.yml")), "critical"));
test("terraform file scores high", () => assertEqual(getTier(scoreFile("infra/main.tf")), "high"));
test("package.json scores medium", () => assertEqual(getTier(scoreFile("package.json")), "medium"));
test("README.md scores low", () => assertEqual(getTier(scoreFile("README.md")), "low"));
test("generateHeatmap returns correct summary", () => {
  const result = generateHeatmap([".github/workflows/ci.yml", "README.md"]);
  assertEqual(result.summary.totalFiles, 2);
});
test("generateHeatmap markdownTable is non-empty", () => {
  const result = generateHeatmap(["README.md"]);
  assert(result.markdownTable.length > 0, "table should be non-empty");
});

console.log("\n=== AWS IAM Analyzer Tests ===");

test("detects privilege escalation actions", () => assert(analyzeIAM('+ "iam:PassRole"').findings.length > 0));
test("detects wildcard resource grant", () => assert(analyzeIAM('+ "Resource": "*"').findings.length > 0));
test("detects dangerous managed policy", () => assert(analyzeIAM('+ arn:aws:iam::aws:policy/AdministratorAccess').findings.length > 0));
test("detects IAM user creation", () => assert(analyzeIAM('+ "iam:CreateUser"').findings.length > 0));
test("clean IAM diff returns low risk", () => assertEqual(analyzeIAM('+ readme change').riskLevel, "low"));
test("non-IAM files return no findings", () => assertEqual(analyzeIAM('').findings.length, 0));

console.log("\n=== Agent Firewall Tests ===");

test("read-only agent cannot merge PR", () => assertEqual(evaluateAgentAction("agent-readonly", "merge_pr").allowed, false));
test("contributor agent can open PR", () => assertEqual(evaluateAgentAction("agent-contributor", "open_pr").allowed, true));
test("deployer agent can deploy to staging", () => assertEqual(evaluateAgentAction("agent-deployer", "deploy_staging").allowed, true));
test("deployer agent cannot deploy to production", () => assertEqual(evaluateAgentAction("agent-deployer", "deploy_production").allowed, false));
test("unknown agent gets read-only tier", () => assertEqual(getAgentTier("missing-agent"), "read-only"));
test("firewall does not apply to human actors", () => assertEqual(evaluateContextFirewall({ agentContext: { isAgentActor: false } }).allowed, true));
test("agent firewall blocks IAM modification by contributor", () => {
  const registry = loadAgentRegistry();
  const result = evaluateContextFirewall({
    actor: "agent-contributor",
    filesChanged: ["infra/iam/main.tf"],
    agentContext: { isAgentActor: true, agentId: "agent-contributor" },
  }, registry);
  assertEqual(result.allowed, false);
});
test("github-actions bot can modify workflows", () => {
  const result = evaluateContextFirewall({
    actor: "github-actions[bot]",
    filesChanged: [".github/workflows/ci.yml"],
    agentContext: { isAgentActor: true, agentId: "github-actions[bot]" },
  });
  assertEqual(result.allowed, true);
});

console.log(`\n${"─".repeat(52)}\n`);
if (failed > 0) {
  console.log("Failed tests:");
  for (const error of errors) {
    console.log(`  ✗ ${error.name}: ${error.error}`);
  }
}
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${"─".repeat(52)}\n`);

if (failed > 0) process.exit(1);
process.exit(0);
