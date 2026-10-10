"use strict";
/**
 * hermes/context/github-context.js
 *
 * Builds a deterministic, CI-aware context object from the GitHub Actions
 * environment and the git diff between the PR branch and origin/main.
 */

const { execSync } = require("child_process");
const { scanForSecrets } = require("../analyzers/secrets.cjs");

function safeExec(cmd) {
  try {
    return execSync(cmd, { stdio: ["pipe", "pipe", "pipe"] }).toString();
  } catch {
    return "";
  }
}

function getDiff() {
  const prDiff = safeExec("git diff origin/main...HEAD");
  if (prDiff.trim().length > 0) return prDiff;
  return safeExec("git diff HEAD");
}

function extractFiles(diff) {
  return diff
    .split("\n")
    .filter((line) => line.startsWith("+++ b/"))
    .map((line) => line.replace("+++ b/", "").trim())
    .filter(Boolean);
}

function computeRiskSignals(files, diff) {
  const secretScan = scanForSecrets(diff);
  return {
    hasSecrets: secretScan.found,
    touchesInfra: files.some((f) =>
      /\.(tf|tfvars|yaml|yml)$/.test(f) &&
      /terraform|k8s|helm|kubernetes|deploy/i.test(f)
    ),
    touchesDependencies: files.some((f) =>
      /package\.json|requirements\.txt|go\.mod|Gemfile|Cargo\.toml/.test(f)
    ),
    touchesWorkflows: files.some((f) => f.includes(".github/workflows/")),
    largeDiff: diff.length > 8000,
    fileCount: files.length,
  };
}

function buildContext() {
  const diff = getDiff();
  const filesChanged = extractFiles(diff);
  const riskSignals = computeRiskSignals(filesChanged, diff);

  return {
    repo: process.env.GITHUB_REPOSITORY || "unknown/unknown",
    branch: process.env.GITHUB_REF_NAME || safeExec("git branch --show-current").trim() || "unknown",
    actor: process.env.GITHUB_ACTOR || "unknown",
    eventName: process.env.GITHUB_EVENT_NAME || "unknown",
    runId: process.env.GITHUB_RUN_ID || "local",
    sha: process.env.GITHUB_SHA || safeExec("git rev-parse HEAD").trim().slice(0, 8),
    commitMessage: safeExec("git log -1 --pretty=%s").trim(),
    filesChanged,
    diffSize: diff.length,
    riskSignals,
  };
}

module.exports = { buildContext, computeRiskSignals, extractFiles, getDiff };
