"use strict";
/**
 * hermes/v3/bot/pr-comment.cjs
 *
 * Hermes v3 — PR Comment Bot
 *
 * Posts a structured Hermes decision report as a PR comment via the GitHub API.
 * Explains why a PR was blocked, warned, or approved — with remediation steps.
 *
 * Required environment variables:
 *   GITHUB_TOKEN       — GitHub Actions token (automatically available)
 *   GITHUB_REPOSITORY  — e.g. "wesship/supreme-ai-deployment-hub"
 *   PR_NUMBER          — The pull request number
 */

const https = require("https");

/**
 * Post a comment to a GitHub PR via the REST API.
 *
 * @param {string} repo - "owner/repo"
 * @param {number} prNumber
 * @param {string} body - Markdown comment body
 * @param {string} token - GitHub token
 * @returns {Promise<void>}
 */
function postComment(repo, prNumber, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ body });
    const options = {
      hostname: "api.github.com",
      path: `/repos/${repo}/issues/${prNumber}/comments`,
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
        "User-Agent": "hermes-v3-bot",
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`GitHub API returned ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

/**
 * Format a Hermes decision into a rich Markdown PR comment.
 *
 * @param {object} decision - The Hermes decision object from evaluateWithOPA()
 * @param {object} context - The Hermes context object
 * @returns {string} Markdown comment body
 */
function formatComment(decision, context) {
  const statusIcon = {
    ALLOW: "✅",
    WARN:  "⚠️",
    DENY:  "❌",
  }[decision.decision] || "🔍";

  const severityBadge = {
    critical: "🔴 **CRITICAL**",
    high:     "🟠 **HIGH**",
    medium:   "🟡 **MEDIUM**",
    low:      "🟢 **LOW**",
    info:     "🔵 **INFO**",
  }[decision.severity] || decision.severity;

  const riskBar = buildRiskBar(decision.riskScore || 0);

  let comment = `## ${statusIcon} Hermes v3 Policy Gate — ${decision.decision}\n\n`;
  comment += `> **${decision.reason}**\n\n`;
  comment += `| Field | Value |\n|-------|-------|\n`;
  comment += `| Policy | \`${decision.policy}\` |\n`;
  comment += `| Severity | ${severityBadge} |\n`;
  comment += `| Risk Score | ${riskBar} ${decision.riskScore}/100 |\n`;
  comment += `| Branch | \`${context.branch}\` |\n`;
  comment += `| Actor | \`${context.actor}\` |\n`;
  comment += `| Commit | \`${context.sha}\` |\n`;
  comment += `| Files Changed | ${context.filesChanged?.length || 0} |\n\n`;

  // File classification breakdown
  const fc = context.fileClassification;
  if (fc) {
    comment += `### File Risk Classification\n\n`;
    comment += `| Tier | Files |\n|------|-------|\n`;
    if (fc.critical?.length) comment += `| 🔴 Critical | ${fc.critical.join(", ")} |\n`;
    if (fc.high?.length)     comment += `| 🟠 High | ${fc.high.join(", ")} |\n`;
    if (fc.medium?.length)   comment += `| 🟡 Medium | ${fc.medium.length} files |\n`;
    if (fc.low?.length)      comment += `| 🟢 Low | ${fc.low.length} files |\n`;
    comment += "\n";
  }

  // Remediation steps
  if (decision.remediationSteps?.length) {
    comment += `### Remediation Steps\n\n`;
    decision.remediationSteps.forEach((step, i) => {
      comment += `${i + 1}. ${step}\n`;
    });
    comment += "\n";
  }

  comment += `---\n*Hermes v3 Policy Gate • [View docs](https://github.com/${context.repo}/blob/main/hermes/v3/README.md)*`;
  return comment;
}

/**
 * Build a simple ASCII risk bar for the PR comment.
 * @param {number} score - 0-100
 * @returns {string}
 */
function buildRiskBar(score) {
  const filled = Math.round(score / 10);
  const empty = 10 - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
}

/**
 * Main: post the Hermes decision as a PR comment.
 *
 * @param {object} decision
 * @param {object} context
 * @returns {Promise<void>}
 */
async function postDecisionComment(decision, context) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY || context.repo;
  const prNumber = process.env.PR_NUMBER || context.pr?.number;

  if (!token) {
    console.log("[hermes-bot] GITHUB_TOKEN not set — skipping PR comment");
    return;
  }

  if (!prNumber) {
    console.log("[hermes-bot] PR_NUMBER not set — skipping PR comment (not a PR event)");
    return;
  }

  const body = formatComment(decision, context);

  try {
    await postComment(repo, prNumber, body, token);
    console.log(`[hermes-bot] Posted decision comment to PR #${prNumber}`);
  } catch (err) {
    console.warn(`[hermes-bot] Failed to post comment: ${err.message}`);
    // Non-fatal — don't block the pipeline if the comment fails
  }
}

module.exports = { postDecisionComment, formatComment, buildRiskBar };
