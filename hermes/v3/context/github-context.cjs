"use strict";
/**
 * hermes/v3/context/github-context.cjs
 *
 * Hermes v3 — Upgraded GitHub Actions Context Builder
 *
 * Enhancements over v2:
 *   - Full PR metadata (title, labels, reviewers, draft status)
 *   - Structured file classification by risk tier
 *   - Trufflehog-compatible secret signal format
 *   - AWS IAM-aware diff signals
 *   - Devonn.AI agent execution context
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

/**
 * Safely execute a shell command.
 * @param {string} cmd
 * @returns {string}
 */
function safeExec(cmd) {
  try {
    return execSync(cmd, { stdio: ["pipe", "pipe", "pipe"] }).toString().trim();
  } catch {
    return "";
  }
}

/**
 * Get the git diff between current branch and origin/main.
 * @returns {string}
 */
function getDiff() {
  const prDiff = safeExec("git diff origin/main...HEAD");
  if (prDiff.length > 0) return prDiff;
  return safeExec("git diff HEAD");
}

/**
 * Extract changed file paths from a unified diff.
 * @param {string} diff
 * @returns {string[]}
 */
function extractFiles(diff) {
  return diff
    .split("\n")
    .filter((l) => l.startsWith("+++ b/"))
    .map((l) => l.replace("+++ b/", "").trim())
    .filter(Boolean);
}

/**
 * Classify files into risk tiers.
 * @param {string[]} files
 * @returns {{ critical: string[], high: string[], medium: string[], low: string[] }}
 */
function classifyFiles(files) {
  const critical = files.filter((f) =>
    /\.github\/workflows\/|terraform\/|k8s\/|iam|secrets?\./.test(f)
  );
  const high = files.filter(
    (f) =>
      !critical.includes(f) &&
      /package\.json|requirements\.txt|Dockerfile|docker-compose/.test(f)
  );
  const medium = files.filter(
    (f) =>
      !critical.includes(f) &&
      !high.includes(f) &&
      /\.(ts|tsx|js|jsx|py)$/.test(f)
  );
  const low = files.filter(
    (f) =>
      !critical.includes(f) &&
      !high.includes(f) &&
      !medium.includes(f)
  );
  return { critical, high, medium, low };
}

/**
 * Compute structured risk signals for the policy engine and heatmap.
 * @param {string[]} files
 * @param {string} diff
 * @returns {object}
 */
function computeRiskSignals(files, diff) {
  return {
    // Secret detection (Trufflehog-compatible patterns)
    hasSecrets: /AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36}|-----BEGIN (RSA|EC|OPENSSH)|SECRET\s*=\s*["']?[a-zA-Z0-9+/=]{16,}/i.test(diff),

    // Infrastructure risk
    touchesInfra: files.some((f) => /terraform|k8s|helm|kubernetes/i.test(f)),
    touchesIAM: files.some((f) => /iam|role|policy|permission/i.test(f)) ||
      /aws_iam_role|aws_iam_policy|aws_iam_user|iam:CreateRole|iam:AttachRolePolicy/i.test(diff),

    // CI/CD risk
    touchesWorkflows: files.some((f) => f.includes(".github/workflows/")),
    touchesDependencies: files.some((f) =>
      /package\.json|requirements\.txt|go\.mod|Gemfile|Cargo\.toml/.test(f)
    ),

    // Diff size signals
    largeDiff: diff.length > 8000,
    massiveDiff: diff.length > 50000,

    // File classification
    fileCount: files.length,
    criticalFileCount: files.filter((f) =>
      /\.github\/workflows\/|terraform\/|k8s\//.test(f)
    ).length,
  };
}

/**
 * Load the GitHub Actions event payload if available.
 * @returns {object}
 */
function loadEventPayload() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) return {};
  try {
    return JSON.parse(fs.readFileSync(eventPath, "utf-8"));
  } catch {
    return {};
  }
}

/**
 * Build the full Hermes v3 context object.
 * @returns {object}
 */
function buildContext() {
  const diff = getDiff();
  const filesChanged = extractFiles(diff);
  const riskSignals = computeRiskSignals(filesChanged, diff);
  const fileClassification = classifyFiles(filesChanged);
  const eventPayload = loadEventPayload();

  // Extract PR metadata from event payload
  const pr = eventPayload.pull_request || {};
  const prMetadata = {
    number: pr.number || null,
    title: pr.title || null,
    isDraft: pr.draft || false,
    labels: (pr.labels || []).map((l) => l.name),
    reviewers: (pr.requested_reviewers || []).map((r) => r.login),
    additions: pr.additions || null,
    deletions: pr.deletions || null,
    changedFiles: pr.changed_files || null,
  };

  return {
    // GitHub Actions environment
    repo: process.env.GITHUB_REPOSITORY || "unknown/unknown",
    branch: process.env.GITHUB_REF_NAME || safeExec("git branch --show-current") || "unknown",
    actor: process.env.GITHUB_ACTOR || "unknown",
    eventName: process.env.GITHUB_EVENT_NAME || "unknown",
    runId: process.env.GITHUB_RUN_ID || "local",
    sha: (process.env.GITHUB_SHA || safeExec("git rev-parse HEAD")).slice(0, 8),

    // PR metadata
    pr: prMetadata,

    // Diff analysis
    filesChanged,
    fileClassification,
    diffSize: diff.length,

    // Risk signals (used by policy engine, heatmap, and firewall)
    riskSignals,

    // Devonn.AI agent context
    agentContext: {
      isAgentActor: /\[bot\]|github-actions|dependabot/.test(process.env.GITHUB_ACTOR || ""),
      agentId: process.env.DEVONN_AGENT_ID || null,
      executionMode: process.env.DEVONN_EXECUTION_MODE || "human",
    },
  };
}

module.exports = { buildContext, classifyFiles, computeRiskSignals };
