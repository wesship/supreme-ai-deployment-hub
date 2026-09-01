"use strict";
/**
 * hermes/core/opa.js
 *
 * OPA-style policy evaluation engine for Hermes v2.
 */

const fs = require("fs");
const path = require("path");

function deny(reason, policy = "unknown") {
  return { decision: "DENY", reason, policy };
}

function warn(reason, policy = "unknown") {
  return { decision: "WARN", reason, policy };
}

function allow(reason, policy = "unknown") {
  return { decision: "ALLOW", reason, policy };
}

function isReleaseReadinessContext(ctx) {
  const branch = ctx.branch || "";
  const commitMessage = ctx.commitMessage || "";
  const changedFiles = ctx.filesChanged || [];

  return /^wave\//.test(branch) ||
    /^release\//.test(branch) ||
    /readiness|convergence|stabilization|release-candidate|runtime recovery/i.test(commitMessage) ||
    changedFiles.some((file) => /WAVE_|RELEASE_|STAGING_|RUNTIME_|PRODUCTION_READINESS|runtime-recovery|wave30|promotion-validation|terraform-validation/i.test(file));
}

function evaluatePolicy(ctx) {
  const commitMsg = ctx.commitMessage || "";
  const isSquashMerge = /\(#\d+\)/.test(commitMsg);
  const isMergeCommit = commitMsg.startsWith("Merge pull request") ||
    commitMsg.startsWith("Merge branch") ||
    /^Merge [0-9a-f]{40} into [0-9a-f]{40}$/.test(commitMsg);
  const isBotActor = ctx.actor === "github-actions[bot]" || ctx.actor === "dependabot[bot]";

  if (ctx.branch === "main" && !isBotActor && !isSquashMerge && !isMergeCommit) {
    return deny("Direct pushes to main are blocked — use a PR", "hermes.ci");
  }

  if (ctx.riskSignals.hasSecrets) {
    return deny(
      "Secrets or credentials detected in diff — remove before merging",
      "hermes.security"
    );
  }

  if (ctx.riskSignals.touchesInfra && ctx.riskSignals.largeDiff) {
    if (isReleaseReadinessContext(ctx)) {
      return warn(
        "Large release-readiness infrastructure change detected — proceed only with green CI evidence and focused review",
        "hermes.security"
      );
    }

    return deny(
      "Large infrastructure change detected — split into smaller PRs",
      "hermes.security"
    );
  }

  if (ctx.riskSignals.touchesInfra) {
    return warn(
      "Infrastructure files modified — ensure Terraform plan has been reviewed",
      "hermes.ci"
    );
  }

  if (ctx.riskSignals.touchesWorkflows) {
    return warn(
      "GitHub Actions workflow files modified — review for security misconfigurations",
      "hermes.ci"
    );
  }

  if (ctx.riskSignals.touchesDependencies) {
    return warn(
      "Dependency manifests modified — Dependency Review and Grype checks will run",
      "hermes.ci"
    );
  }

  return allow("All policy checks passed", "hermes.main");
}

function loadPolicyPack() {
  const policiesDir = path.join(__dirname, "../policies");
  try {
    return fs.readdirSync(policiesDir).filter((f) => f.endsWith(".rego"));
  } catch {
    return [];
  }
}

function evaluateWithOPA(context) {
  const policiesLoaded = loadPolicyPack();
  const result = evaluatePolicy(context);
  return { ...result, policiesLoaded };
}

module.exports = { evaluateWithOPA, deny, warn, allow, isReleaseReadinessContext };
