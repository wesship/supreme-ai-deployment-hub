"use strict";
/**
 * hermes/core/opa.js
 *
 * OPA-style policy evaluation engine for Hermes v2.
 *
 * Architecture:
 *   - Loads policy packs from hermes/policies/
 *   - Evaluates context against each policy in priority order
 *   - Returns a single deterministic Decision object
 *
 * Decision contract:
 *   { decision: "ALLOW" | "WARN" | "DENY", reason: string, policy: string }
 *
 * Future upgrade path:
 *   Replace evaluatePolicy() with a real OPA WASM runtime via
 *   @open-policy-agent/opa-wasm for full Rego evaluation.
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Decision constructors
// ---------------------------------------------------------------------------

/**
 * @param {string} reason
 * @param {string} policy
 * @returns {{ decision: "DENY", reason: string, policy: string }}
 */
function deny(reason, policy = "unknown") {
  return { decision: "DENY", reason, policy };
}

/**
 * @param {string} reason
 * @param {string} policy
 * @returns {{ decision: "WARN", reason: string, policy: string }}
 */
function warn(reason, policy = "unknown") {
  return { decision: "WARN", reason, policy };
}

/**
 * @param {string} reason
 * @param {string} policy
 * @returns {{ decision: "ALLOW", reason: string, policy: string }}
 */
function allow(reason, policy = "unknown") {
  return { decision: "ALLOW", reason, policy };
}

// ---------------------------------------------------------------------------
// Policy rules (deterministic, CI-safe, OPA-compatible structure)
// ---------------------------------------------------------------------------

/**
 * Evaluate the context against all policy rules.
 * Rules are evaluated in priority order: DENY rules first, then WARN, then ALLOW.
 *
 * @param {object} ctx - The Hermes context object from buildContext()
 * @returns {{ decision: string, reason: string, policy: string }}
 */
function evaluatePolicy(ctx) {
  // ── DENY rules (hard blocks) ─────────────────────────────────────────────

  // ci.rego: block direct pushes to main by humans
  if (
    ctx.branch === "main" &&
    ctx.actor !== "github-actions[bot]" &&
    ctx.actor !== "dependabot[bot]"
  ) {
    return deny("Direct pushes to main are blocked — use a PR", "hermes.ci");
  }

  // security.rego: block any diff containing secret patterns
  if (ctx.riskSignals.hasSecrets) {
    return deny(
      "Secrets or credentials detected in diff — remove before merging",
      "hermes.security"
    );
  }

  // security.rego: block large infra changes (high blast radius)
  if (ctx.riskSignals.touchesInfra && ctx.riskSignals.largeDiff) {
    return deny(
      "Large infrastructure change detected — split into smaller PRs",
      "hermes.security"
    );
  }

  // ── WARN rules (advisory, non-blocking) ──────────────────────────────────

  // infra modification without being a large diff
  if (ctx.riskSignals.touchesInfra) {
    return warn(
      "Infrastructure files modified — ensure Terraform plan has been reviewed",
      "hermes.ci"
    );
  }

  // CI/CD workflow changes
  if (ctx.riskSignals.touchesWorkflows) {
    return warn(
      "GitHub Actions workflow files modified — review for security misconfigurations",
      "hermes.ci"
    );
  }

  // Dependency manifest changes
  if (ctx.riskSignals.touchesDependencies) {
    return warn(
      "Dependency manifests modified — Dependabot and Snyk scans will run",
      "hermes.ci"
    );
  }

  // ── ALLOW ────────────────────────────────────────────────────────────────
  return allow("All policy checks passed", "hermes.main");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load policy metadata from hermes/policies/ (for logging/audit purposes).
 * In a real OPA WASM setup this would load and compile the .rego files.
 *
 * @returns {string[]} list of policy file names
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
 * Main entry point: evaluate context and return a Decision.
 *
 * @param {object} context - The Hermes context object
 * @returns {{ decision: string, reason: string, policy: string, policiesLoaded: string[] }}
 */
function evaluateWithOPA(context) {
  const policiesLoaded = loadPolicyPack();
  const result = evaluatePolicy(context);
  return { ...result, policiesLoaded };
}

module.exports = { evaluateWithOPA, deny, warn, allow };
