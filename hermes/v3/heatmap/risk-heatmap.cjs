"use strict";
/**
 * hermes/v3/heatmap/risk-heatmap.cjs
 *
 * Hermes v3 — Risk Heatmap Generator
 *
 * Generates a per-file risk heatmap from the Hermes context.
 * Output formats:
 *   - JSON (for programmatic consumption)
 *   - Markdown table (for PR comments and CI summaries)
 *
 * Risk tiers:
 *   critical (80-100) — IAM, secrets, workflow files
 *   high     (60-79)  — Terraform, Dockerfiles, dependency manifests
 *   medium   (40-59)  — Application source code
 *   low      (0-39)   — Documentation, tests, configs
 */

/**
 * Compute a risk score for a single file path.
 *
 * @param {string} filePath
 * @param {string} diff - Full diff string (used for content-based scoring)
 * @returns {number} 0-100
 */
function scoreFile(filePath, diff) {
  let score = 0;

  // Critical patterns
  if (/\.github\/workflows\//.test(filePath))           score += 80;
  else if (/iam|role|policy|permission/i.test(filePath)) score += 75;
  else if (/secrets?|credentials?/i.test(filePath))     score += 90;
  else if (/terraform\/.*\.tf$/.test(filePath))          score += 65;
  else if (/k8s\/|kubernetes\//i.test(filePath))         score += 60;
  else if (/Dockerfile/i.test(filePath))                 score += 55;
  else if (/docker-compose/i.test(filePath))             score += 50;
  else if (/package\.json$/.test(filePath))              score += 45;
  else if (/requirements\.txt$/.test(filePath))          score += 40;
  else if (/\.(ts|tsx|js|jsx)$/.test(filePath))          score += 30;
  else if (/\.(py|go|rs)$/.test(filePath))               score += 25;
  else if (/\.(md|txt|json|yaml|yml)$/.test(filePath))   score += 10;
  else                                                    score += 5;

  return Math.min(score, 100);
}

/**
 * Get the risk tier label for a score.
 * @param {number} score
 * @returns {string}
 */
function getTier(score) {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

/**
 * Get the emoji indicator for a risk tier.
 * @param {string} tier
 * @returns {string}
 */
function getTierIcon(tier) {
  return { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢" }[tier] || "⚪";
}

/**
 * Generate a risk heatmap from the Hermes context.
 *
 * @param {object} context - Hermes v3 context object
 * @returns {{ entries: Array, summary: object, markdownTable: string }}
 */
function generateHeatmap(context) {
  const files = context.filesChanged || [];
  const diff = "";  // diff not stored in context to keep it small

  const entries = files
    .map((file) => {
      const score = scoreFile(file, diff);
      const tier = getTier(score);
      return { file, score, tier, icon: getTierIcon(tier) };
    })
    .sort((a, b) => b.score - a.score);

  const summary = {
    totalFiles: entries.length,
    critical: entries.filter((e) => e.tier === "critical").length,
    high:     entries.filter((e) => e.tier === "high").length,
    medium:   entries.filter((e) => e.tier === "medium").length,
    low:      entries.filter((e) => e.tier === "low").length,
    overallRisk: entries.length > 0
      ? Math.round(entries.reduce((sum, e) => sum + e.score, 0) / entries.length)
      : 0,
  };

  const markdownTable = buildMarkdownTable(entries, summary);

  return { entries, summary, markdownTable };
}

/**
 * Build a Markdown table for the heatmap.
 * @param {Array} entries
 * @param {object} summary
 * @returns {string}
 */
function buildMarkdownTable(entries, summary) {
  if (entries.length === 0) {
    return "_No files changed._\n";
  }

  let table = `### Risk Heatmap\n\n`;
  table += `| Risk | File | Score |\n|------|------|-------|\n`;

  // Show top 20 files to keep the comment readable
  const shown = entries.slice(0, 20);
  for (const { icon, file, score } of shown) {
    table += `| ${icon} | \`${file}\` | ${score}/100 |\n`;
  }

  if (entries.length > 20) {
    table += `| ... | _${entries.length - 20} more files_ | — |\n`;
  }

  table += `\n**Summary:** ${summary.critical} critical, ${summary.high} high, `;
  table += `${summary.medium} medium, ${summary.low} low | `;
  table += `**Overall Risk: ${summary.overallRisk}/100**\n`;

  return table;
}

module.exports = { generateHeatmap, scoreFile, getTier, getTierIcon };
