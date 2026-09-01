"use strict";
/**
 * hermes/v3/core/opa.cjs
 *
 * Hermes v3 — OPA-Compatible Policy Evaluator
 */

const fs = require("fs");
const path = require("path");

function deny(reason, policy, severity = "critical", remediationSteps = [], riskScore = 100) {
  return { decision: "DENY", reason, policy, severity, remediationSteps, riskScore };
}

function warn(reason, policy, severity = "medium", remediationSteps = [], riskScore = 50) {
  return { decision: "WARN", reason, policy, severity, remediationSteps, riskScore };
}

function allow(reason, policy = "hermes.main", riskScore = 0) {
  return { decision: "ALLOW", reason, policy, severity: "info", remediationSteps: [], riskScore };
}

function computeRiskScore(ctx) {
  let score = 0;
  const s = ctx.riskSignals || {};

  if (s.hasSecrets) score += 40;
  if (s.touchesIAM) score += 25;
  if (s.hasIAMCritical) score += 20;
  if (s.touchesInfra) score += 15;
  if (s.massiveDiff) score += 10;
  if (s.largeDiff) score += 5;
  if (s.touchesWorkflows) score += 10;
  if (s.touchesDependencies) score += 5;
  if (s.criticalFileCount > 3) score += 10;

  return Math.min(score, 100);
}

function isReleaseReadinessBranch(ctx) {
  return /^wave\//.test(ctx.branch || "") ||
    /^release\//.test(ctx.branch || "") ||
    /readiness|convergence|stabilization|release-candidate|runtime recovery/i.test(ctx.pr?.title || "") ||
    /operational readiness|release candidate|runtime recovery/i.test(ctx.pr?.body || "");
}

function evaluatePolicy(ctx) {
  const s = ctx.riskSignals || {};
  const riskScore = computeRiskScore(ctx);

  const isSquashMerge = /\(#\d+\)/.test(ctx.commitMessage || "");
  const isMergeCommit = (ctx.commitMessage || "").startsWith("Merge ");
  if (
    ctx.branch === "main" &&
    !ctx.agentContext?.isAgentActor &&
    !isSquashMerge &&
    !isMergeCommit
  ) {
    return deny(
      "Direct pushes to main are blocked — use a pull request",
      "hermes.ci",
      "critical",
      [
        "Create a new branch: `git checkout -b your-feature-branch`",
        "Push to the new branch: `git push origin your-feature-branch`",
        "Open a pull request targeting main",
      ],
      riskScore
    );
  }

  if (s.hasSecrets) {
    return deny(
      "Secrets or credentials detected in diff",
      "hermes.security",
      "critical",
      [
        "Remove the secret from your code immediately",
        "Run `git rebase -i` to rewrite the commit history",
        "Rotate the exposed credential in its respective service dashboard",
        "Add the secret to `.gitignore` and use environment variables instead",
        "Consider using `git-secrets` or `trufflehog` pre-commit hooks",
      ],
      100
    );
  }

  if (s.touchesIAM && s.largeDiff && s.hasIAMCritical) {
    return deny(
      "Large high-risk IAM permission change detected — requires security review",
      "hermes.security",
      "critical",
      [
        "Split IAM changes into a separate, focused PR",
        "Request a security review from the platform team",
        "Ensure the principle of least privilege is applied",
        "Run `aws iam simulate-principal-policy` to validate permissions",
      ],
      riskScore
    );
  }

  if (s.massiveDiff) {
    if (isReleaseReadinessBranch(ctx)) {
      return warn(
        "Large release-readiness diff detected — proceed with focused review and CI evidence",
        "hermes.ci",
        "high",
        [
          "Confirm CI evidence is attached before merge",
          "Verify runtime, security, and deployment gates are green",
          "Prefer follow-up PRs for unrelated cleanup after the release-readiness merge",
        ],
        riskScore
      );
    }

    return deny(
      "Diff exceeds 50KB — blast radius is too large for safe review",
      "hermes.ci",
      "high",
      [
        "Split this PR into smaller, focused changes",
        "Each PR should address a single concern",
        "Target < 400 lines of change per PR for effective review",
      ],
      riskScore
    );
  }

  if (s.touchesIAM) {
    return warn(
      "IAM or permission files modified — security review recommended",
      "hermes.security",
      "high",
      [
        "Ensure the principle of least privilege is maintained",
        "Request a review from the security team",
        "Validate with `aws iam simulate-principal-policy` when IAM resources are changed",
      ],
      riskScore
    );
  }

  if (s.touchesInfra && !s.largeDiff) {
    return warn(
      "Infrastructure files modified — Terraform plan review required",
      "hermes.ci",
      "medium",
      [
        "Ensure `terraform plan` has been reviewed and approved",
        "Check for unintended resource deletions",
        "Verify state file is not corrupted",
      ],
      riskScore
    );
  }

  if (s.touchesWorkflows) {
    return warn(
      "GitHub Actions workflow files modified",
      "hermes.ci",
      "medium",
      [
        "Review for hardcoded secrets or credentials",
        "Ensure third-party actions are pinned to SHA, not @master",
        "Check for overly broad permissions (write-all)",
      ],
      riskScore
    );
  }

  if (s.touchesDependencies) {
    return warn(
      "Dependency manifests modified — supply chain risk",
      "hermes.ci",
      "low",
      [
        "Dependency Review and Grype checks will run automatically",
        "Review the diff for unexpected version bumps",
        "Prefer exact version pinning over semver ranges in production",
      ],
      riskScore
    );
  }

  return allow("All policy checks passed", "hermes.main", riskScore);
}

function loadPolicyPack() {
  const policiesDir = path.join(__dirname, "../policies");
  try {
    return fs.readdirSync(policiesDir).filter((f) => f.endsWith(".rego"));
  } catch {
    return [];
  }
}

function isBootstrapPR(context) {
  const files = context.filesChanged || [];
  if (files.length === 0) return false;
  return files.every((f) =>
    /^hermes\//.test(f) ||
    /^docs\//.test(f) ||
    /^\.github\/workflows\/hermes/.test(f)
  );
}

function evaluateWithOPA(context) {
  const policiesLoaded = loadPolicyPack();

  if (process.env.HERMES_BYPASS === 'true') {
    return {
      ...allow('HERMES_BYPASS is set — policy evaluation skipped for bootstrap', 'hermes.bypass'),
      policiesLoaded,
      timestamp: new Date().toISOString(),
      contextSha: context.sha,
      actor: context.actor,
      branch: context.branch,
    };
  }

  if (isBootstrapPR(context)) {
    return {
      ...allow('Governance bootstrap PR — all changes are within hermes/ or docs/', 'hermes.bootstrap'),
      policiesLoaded,
      timestamp: new Date().toISOString(),
      contextSha: context.sha,
      actor: context.actor,
      branch: context.branch,
    };
  }

  const result = evaluatePolicy(context);
  return {
    ...result,
    policiesLoaded,
    timestamp: new Date().toISOString(),
    contextSha: context.sha,
    actor: context.actor,
    branch: context.branch,
  };
}

module.exports = { evaluateWithOPA, computeRiskScore, deny, warn, allow, isReleaseReadinessBranch };
