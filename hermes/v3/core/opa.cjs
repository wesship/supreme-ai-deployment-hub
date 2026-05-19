"use strict";
/**
 * hermes/v3/core/opa.cjs
 *
 * Hermes v3 — OPA-Compatible Policy Evaluator
 *
 * Architecture:
 *   - Evaluates context against ordered policy packs
 *   - Returns a Decision with full explanation for the PR comment bot
 *   - Designed for future migration to real OPA WASM via @open-policy-agent/opa-wasm
 *
 * Decision contract:
 *   {
 *     decision: "ALLOW" | "WARN" | "DENY",
 *     reason: string,
 *     policy: string,
 *     severity: "critical" | "high" | "medium" | "low" | "info",
 *     remediationSteps: string[],
 *     riskScore: number (0-100),
 *   }
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Decision constructors
// ---------------------------------------------------------------------------

function deny(reason, policy, severity = "critical", remediationSteps = [], riskScore = 100) {
  return { decision: "DENY", reason, policy, severity, remediationSteps, riskScore };
}

function warn(reason, policy, severity = "medium", remediationSteps = [], riskScore = 50) {
  return { decision: "WARN", reason, policy, severity, remediationSteps, riskScore };
}

function allow(reason, policy = "hermes.main", riskScore = 0) {
  return { decision: "ALLOW", reason, policy, severity: "info", remediationSteps: [], riskScore };
}

// ---------------------------------------------------------------------------
// Risk score computation
// ---------------------------------------------------------------------------

/**
 * Compute a numeric risk score (0-100) from the context's risk signals.
 * Used for heatmap rendering and trend analysis.
 *
 * @param {object} ctx
 * @returns {number}
 */
function computeRiskScore(ctx) {
  let score = 0;
  const s = ctx.riskSignals || {};

  if (s.hasSecrets)          score += 40;
  if (s.touchesIAM)          score += 25;
  if (s.touchesInfra)        score += 15;
  if (s.massiveDiff)         score += 10;
  if (s.largeDiff)           score += 5;
  if (s.touchesWorkflows)    score += 10;
  if (s.touchesDependencies) score += 5;
  if (s.criticalFileCount > 3) score += 10;

  return Math.min(score, 100);
}

// ---------------------------------------------------------------------------
// Policy rule evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate context against all policy rules in priority order.
 *
 * @param {object} ctx - Hermes v3 context object
 * @returns {object} Decision
 */
function evaluatePolicy(ctx) {
  const s = ctx.riskSignals || {};
  const riskScore = computeRiskScore(ctx);

  // ── DENY rules (hard blocks) ─────────────────────────────────────────────

  // ci.rego: block direct pushes to main by humans
  // Exception: squash-merge commits from PRs arrive as push events but contain
  // "(#NNN)" in the commit message — these are legitimate and should be allowed.
  const isSquashMerge = /\(#\d+\)/.test(ctx.commitMessage || "");
  const isMergeCommit = (ctx.commitMessage || "").startsWith("Merge ");
  const isEventPush = ctx.eventName === "push";
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

  // security.rego: block secrets in diff
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

  // security.rego: block large IAM changes
  if (s.touchesIAM && s.largeDiff) {
    return deny(
      "Large IAM permission change detected — requires security review",
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

  // security.rego: block massive diffs (blast radius too high)
  if (s.massiveDiff) {
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

  // ── WARN rules (advisory, non-blocking) ──────────────────────────────────

  if (s.touchesIAM) {
    return warn(
      "IAM or permission files modified — security review recommended",
      "hermes.security",
      "high",
      [
        "Ensure the principle of least privilege is maintained",
        "Request a review from the security team",
        "Validate with `aws iam simulate-principal-policy`",
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
        "Dependabot and Snyk scans will run automatically",
        "Review the diff for unexpected version bumps",
        "Prefer exact version pinning over semver ranges in production",
      ],
      riskScore
    );
  }

  // ── ALLOW ────────────────────────────────────────────────────────────────
  return allow("All policy checks passed", "hermes.main", riskScore);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load policy file names from hermes/v3/policies/ for audit logging.
 * @returns {string[]}
 */
function loadPolicyPack() {
  const policiesDir = path.join(__dirname, "../policies");
  try {
    return fs.readdirSync(policiesDir).filter((f) => f.endsWith(".rego"));
  } catch {
    return [];
  }
}

/**
 * Check if this is a bootstrap/governance-introduction PR.
 * A PR is considered a bootstrap if ALL changed files are within hermes/ or docs/.
 * This prevents the governance engine from blocking its own introduction commit.
 *
 * @param {object} context
 * @returns {boolean}
 */
function isBootstrapPR(context) {
  const files = context.filesChanged || [];
  if (files.length === 0) return false;
  return files.every((f) =>
    /^hermes\//.test(f) ||
    /^docs\//.test(f) ||
    /^\.github\/workflows\/hermes/.test(f)
  );
}

/**
 * Main entry point: evaluate context and return a full Decision object.
 *
 * @param {object} context - Hermes v3 context
 * @returns {object} Decision with explanation and remediation steps
 */
function evaluateWithOPA(context) {
  const policiesLoaded = loadPolicyPack();

  // Allow HERMES_BYPASS for CI bootstrap scenarios (must be set explicitly)
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

  // Allow governance bootstrap PRs (hermes/ and docs/ files only)
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

module.exports = { evaluateWithOPA, computeRiskScore, deny, warn, allow };
