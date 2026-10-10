"use strict";
/**
 * hermes/analyzers/diff.js
 *
 * General-purpose diff analyzer for Hermes v2.
 * Provides structured metadata about a git diff for use by the policy engine.
 */

/**
 * Parse a unified diff string into structured metadata.
 *
 * @param {string} diff - The git diff string
 * @returns {object} Structured diff metadata
 */
function analyzeDiff(diff) {
  const lines = diff.split("\n");

  let additions = 0;
  let deletions = 0;
  const filesChanged = new Set();

  for (const line of lines) {
    if (line.startsWith("+++ b/")) {
      filesChanged.add(line.replace("+++ b/", "").trim());
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      additions++;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      deletions++;
    }
  }

  const totalChanges = additions + deletions;
  const churnRatio = deletions > 0 ? additions / deletions : additions;

  return {
    filesChanged: [...filesChanged],
    fileCount: filesChanged.size,
    additions,
    deletions,
    totalChanges,
    diffSize: diff.length,
    churnRatio: Math.round(churnRatio * 100) / 100,
    isLarge: diff.length > 8000,
    isEmpty: diff.trim().length === 0,
  };
}

module.exports = { analyzeDiff };
