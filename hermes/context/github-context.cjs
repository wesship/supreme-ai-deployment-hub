"use strict";
/**
 * hermes/context/github-context.js
 *
 * Builds a deterministic, CI-aware context object from the GitHub Actions
 * environment and the git diff between the PR branch and origin/main.
 *
 * Works correctly in:
 *   - GitHub Actions pull_request events
 *   - GitHub Actions push events
 *   - Local development (falls back gracefully)
 */

const { execSync } = require("child_process");

/**
 * Safely execute a shell command and return its stdout as a string.
 * Returns an empty string on failure rather than throwing.
 *
 * @param {string} cmd
 * @returns {string}
 */
function safeExec(cmd) {
  try {
    return execSync(cmd, { stdio: ["pipe", "pipe", "pipe"] }).toString();
  } catch {
    return "";
  }
}

/**
 * Get the git diff between the current branch and origin/main.
 * Tries the PR-aware three-dot diff first; falls back to HEAD diff.
 *
 * @returns {string}
 */
function getDiff() {
  const prDiff = safeExec("git diff origin/main...HEAD");
  if (prDiff.trim().length > 0) return prDiff;
  return safeExec("git diff HEAD");
}

/**
 * Extract the list of changed files from a unified diff string.
 *
 * @param {string} diff
 * @returns {string[]}
 */
function extractFiles(diff) {
  return diff
    .split("\n")
    .filter((line) => line.startsWith("+++ b/"))
    .map((line) => line.replace("+++ b/", "").trim())
    .filter(Boolean);
}

/**
 * Compute structured risk signals from the diff and file list.
 * Returns a plain object — no heuristic float scores, only boolean signals
 * that can be evaluated deterministically by the policy engine.
 *
 * @param {string[]} files
 * @param {string} diff
 * @returns {object}
 */
function computeRiskSignals(files, diff) {
  return {
    // Secret patterns: AWS keys, generic tokens, passwords, private keys
    hasSecrets: /AKIA[0-9A-Z]{16}|SECRET|PASSWORD|PRIVATE_KEY|-----BEGIN (RSA|EC|OPENSSH)/i.test(diff),

    // Infrastructure changes: Terraform, Kubernetes, Helm, Docker
    touchesInfra: files.some((f) =>
      /\.(tf|tfvars|yaml|yml)$/.test(f) &&
      /terraform|k8s|helm|kubernetes|deploy/i.test(f)
    ),

    // Dependency manifest changes (supply chain risk)
    touchesDependencies: files.some((f) =>
      /package\.json|requirements\.txt|go\.mod|Gemfile|Cargo\.toml/.test(f)
    ),

    // CI/CD workflow changes
    touchesWorkflows: files.some((f) => f.includes(".github/workflows/")),

    // Large diff (> 8 KB of changes) — may indicate bulk changes needing review
    largeDiff: diff.length > 8000,

    // Number of files changed
    fileCount: files.length,
  };
}

/**
 * Build and return the full Hermes context object.
 *
 * @returns {object}
 */
function buildContext() {
  const diff = getDiff();
  const filesChanged = extractFiles(diff);
  const riskSignals = computeRiskSignals(filesChanged, diff);

  return {
    // GitHub Actions environment variables
    repo: process.env.GITHUB_REPOSITORY || "unknown/unknown",
    branch: process.env.GITHUB_REF_NAME || safeExec("git branch --show-current").trim() || "unknown",
    actor: process.env.GITHUB_ACTOR || "unknown",
    eventName: process.env.GITHUB_EVENT_NAME || "unknown",
    runId: process.env.GITHUB_RUN_ID || "local",
    sha: process.env.GITHUB_SHA || safeExec("git rev-parse HEAD").trim().slice(0, 8),

    // Diff analysis
    filesChanged,
    diffSize: diff.length,

    // Structured risk signals (used by policy engine)
    riskSignals,
  };
}

module.exports = { buildContext };
