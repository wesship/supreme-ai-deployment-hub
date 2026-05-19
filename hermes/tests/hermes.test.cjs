"use strict";
/**
 * hermes/tests/hermes.test.js
 *
 * Unit tests for Hermes v2 Policy Gate.
 * Run with: node hermes/tests/hermes.test.js
 *
 * Tests the policy engine in isolation — no GitHub Actions environment needed.
 */

const { evaluateWithOPA } = require("../core/opa.cjs");
const { scanForSecrets } = require("../analyzers/secrets.cjs");
const { analyzeDiff } = require("../analyzers/diff.cjs");
const { analyzeTerraform } = require("../analyzers/terraform.cjs");

// ---------------------------------------------------------------------------
// Minimal test harness (no external dependencies)
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    → ${err.message}`);
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

// ---------------------------------------------------------------------------
// Policy engine tests
// ---------------------------------------------------------------------------

console.log("\n=== Policy Engine Tests ===");

test("DENY: direct push to main by human", () => {
  const ctx = {
    branch: "main",
    actor: "wesship",
    riskSignals: { hasSecrets: false, touchesInfra: false, largeDiff: false, touchesWorkflows: false, touchesDependencies: false },
  };
  const result = evaluateWithOPA(ctx);
  assertEqual(result.decision, "DENY", "decision");
  assert(result.policy === "hermes.ci", "policy should be hermes.ci");
});

test("ALLOW: push to main by github-actions bot", () => {
  const ctx = {
    branch: "main",
    actor: "github-actions[bot]",
    riskSignals: { hasSecrets: false, touchesInfra: false, largeDiff: false, touchesWorkflows: false, touchesDependencies: false },
  };
  const result = evaluateWithOPA(ctx);
  assertEqual(result.decision, "ALLOW", "decision");
});

test("DENY: secrets in diff", () => {
  const ctx = {
    branch: "feature/my-feature",
    actor: "wesship",
    riskSignals: { hasSecrets: true, touchesInfra: false, largeDiff: false, touchesWorkflows: false, touchesDependencies: false },
  };
  const result = evaluateWithOPA(ctx);
  assertEqual(result.decision, "DENY", "decision");
  assert(result.policy === "hermes.security", "policy should be hermes.security");
});

test("DENY: large infra change", () => {
  const ctx = {
    branch: "feature/infra-overhaul",
    actor: "wesship",
    riskSignals: { hasSecrets: false, touchesInfra: true, largeDiff: true, touchesWorkflows: false, touchesDependencies: false },
  };
  const result = evaluateWithOPA(ctx);
  assertEqual(result.decision, "DENY", "decision");
});

test("WARN: small infra change", () => {
  const ctx = {
    branch: "feature/add-sg-rule",
    actor: "wesship",
    riskSignals: { hasSecrets: false, touchesInfra: true, largeDiff: false, touchesWorkflows: false, touchesDependencies: false },
  };
  const result = evaluateWithOPA(ctx);
  assertEqual(result.decision, "WARN", "decision");
});

test("WARN: workflow file changed", () => {
  const ctx = {
    branch: "feature/fix-ci",
    actor: "wesship",
    riskSignals: { hasSecrets: false, touchesInfra: false, largeDiff: false, touchesWorkflows: true, touchesDependencies: false },
  };
  const result = evaluateWithOPA(ctx);
  assertEqual(result.decision, "WARN", "decision");
});

test("ALLOW: clean feature branch", () => {
  const ctx = {
    branch: "feature/add-dashboard",
    actor: "wesship",
    riskSignals: { hasSecrets: false, touchesInfra: false, largeDiff: false, touchesWorkflows: false, touchesDependencies: false },
  };
  const result = evaluateWithOPA(ctx);
  assertEqual(result.decision, "ALLOW", "decision");
});

// ---------------------------------------------------------------------------
// Secrets analyzer tests
// ---------------------------------------------------------------------------

console.log("\n=== Secrets Analyzer Tests ===");

test("detects AWS access key", () => {
  const diff = "+AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE";
  const result = scanForSecrets(diff);
  assert(result.found, "should find AWS key");
  assert(result.findings.some((f) => f.name === "AWS Access Key"), "should name it");
});

test("detects GitHub PAT", () => {
  const diff = "+TOKEN=ghp_abcdefghijklmnopqrstuvwxyz1234567890";
  const result = scanForSecrets(diff);
  assert(result.found, "should find GitHub PAT");
});

test("detects private key header", () => {
  const diff = "+-----BEGIN RSA PRIVATE KEY-----";
  const result = scanForSecrets(diff);
  assert(result.found, "should find private key");
});

test("clean diff returns no findings", () => {
  const diff = "+const greeting = 'hello world';";
  const result = scanForSecrets(diff);
  assert(!result.found, "should not find secrets in clean diff");
  assertEqual(result.findings.length, 0, "findings count");
});

// ---------------------------------------------------------------------------
// Diff analyzer tests
// ---------------------------------------------------------------------------

console.log("\n=== Diff Analyzer Tests ===");

test("parses additions and deletions", () => {
  const diff = `--- a/src/app.ts\n+++ b/src/app.ts\n+const x = 1;\n-const y = 2;\n+const z = 3;`;
  const result = analyzeDiff(diff);
  assertEqual(result.additions, 2, "additions");
  assertEqual(result.deletions, 1, "deletions");
  assertEqual(result.fileCount, 1, "fileCount");
});

test("detects large diff", () => {
  const diff = "+" + "x".repeat(9000);
  const result = analyzeDiff(diff);
  assert(result.isLarge, "should be large");
});

test("detects empty diff", () => {
  const result = analyzeDiff("");
  assert(result.isEmpty, "should be empty");
});

// ---------------------------------------------------------------------------
// Terraform analyzer tests
// ---------------------------------------------------------------------------

console.log("\n=== Terraform Analyzer Tests ===");

test("detects terraform changes", () => {
  const files = ["infrastructure/main.tf", "src/app.ts"];
  const diff = `+resource "aws_iam_role" "my_role" {}`;
  const result = analyzeTerraform(diff, files);
  assert(result.hasTerraformChanges, "should detect terraform");
  assert(result.highRiskResources.includes("aws_iam_role"), "should flag iam_role");
});

test("no terraform changes", () => {
  const files = ["src/app.ts", "README.md"];
  const result = analyzeTerraform("", files);
  assert(!result.hasTerraformChanges, "should not detect terraform");
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${"─".repeat(44)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${"─".repeat(44)}\n`);

if (failed > 0) {
  process.exit(1);
}
process.exit(0);
