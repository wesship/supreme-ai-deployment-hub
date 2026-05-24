#!/usr/bin/env node
"use strict";
/**
 * hermes/v3/core/engine.cjs
 *
 * Hermes v3 — Autonomous Governance Layer — CI Entrypoint
 */

const { buildContext }            = require("../context/github-context.cjs");
const { evaluateWithOPA }         = require("./opa.cjs");
const { postDecisionComment }     = require("../bot/pr-comment.cjs");
const { generateHeatmap }         = require("../heatmap/risk-heatmap.cjs");
const { analyzeIAM }              = require("../iam/aws-iam.cjs");
const { evaluateContextFirewall } = require("../firewall/agent-firewall.cjs");

function isGovernanceFixtureFile(filePath) {
  return /(^|\/)hermes\/v3\/tests\//.test(filePath) ||
    /(^|\/)hermes\/tests\//.test(filePath) ||
    /(^|\/)test-fixtures?\//.test(filePath) ||
    /(^|\/)fixtures?\//.test(filePath);
}

function filterGovernanceFixtureDiff(diff) {
  const blocks = diff.split(/^diff --git /m);
  return blocks
    .filter((block, index) => {
      if (index === 0 && block.trim() === "") return false;
      const normalized = index === 0 ? block : `diff --git ${block}`;
      const match = normalized.match(/^diff --git a\/(.*?) b\/(.*)$/m);
      if (!match) return true;
      return !isGovernanceFixtureFile(match[1]) && !isGovernanceFixtureFile(match[2]);
    })
    .join("");
}

(async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║      HERMES v3 — AUTONOMOUS GOVERNANCE LAYER     ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  let context;
  try {
    context = buildContext();
    console.log("✓ Context built");
    console.log(`  Branch: ${context.branch} | Actor: ${context.actor} | Files: ${context.filesChanged.length}`);
    console.log("");
  } catch (err) {
    console.error("❌ Failed to build context:", err.message);
    process.exit(1);
  }

  let iamAnalysis = { hasIAMChanges: false, findings: [], riskLevel: "none" };
  try {
    const { execSync } = require("child_process");
    const rawDiff = (() => {
      try { return execSync("git diff origin/main...HEAD", { stdio: ["pipe","pipe","pipe"] }).toString(); }
      catch { return execSync("git diff HEAD", { stdio: ["pipe","pipe","pipe"] }).toString(); }
    })();
    const diff = filterGovernanceFixtureDiff(rawDiff);
    const iamFiles = context.filesChanged.filter((file) => !isGovernanceFixtureFile(file));
    iamAnalysis = analyzeIAM(diff, iamFiles);
    if (iamAnalysis.hasIAMChanges) {
      console.log(`⚠️  IAM changes detected — risk level: ${iamAnalysis.riskLevel}`);
      iamAnalysis.findings.forEach((f) => console.log(`   [${f.severity}] ${f.message}`));
      console.log("");
    }
  } catch (err) {
    console.warn("⚠️  IAM analysis failed (non-fatal):", err.message);
  }

  let heatmap = { entries: [], summary: {}, markdownTable: "" };
  try {
    heatmap = generateHeatmap(context);
    console.log(`✓ Risk heatmap generated — overall risk: ${heatmap.summary.overallRisk}/100`);
    console.log(`  Critical: ${heatmap.summary.critical} | High: ${heatmap.summary.high} | Medium: ${heatmap.summary.medium} | Low: ${heatmap.summary.low}`);
    console.log("");
  } catch (err) {
    console.warn("⚠️  Heatmap generation failed (non-fatal):", err.message);
  }

  let firewallResult = { blocked: false, violations: [] };
  try {
    firewallResult = evaluateContextFirewall(context);
    if (firewallResult.isAgentActor) {
      if (firewallResult.blocked) {
        console.error(`❌ AGENT FIREWALL BLOCKED: ${firewallResult.violations.length} violation(s)`);
        firewallResult.violations.forEach((v) => console.error(`   ${v.reason}`));
        console.log("");
      } else {
        console.log(`✓ Agent firewall passed — agent: ${firewallResult.agentId}`);
        console.log("");
      }
    }
  } catch (err) {
    console.warn("⚠️  Agent firewall check failed (non-fatal):", err.message);
  }

  let decision;
  try {
    if (iamAnalysis.hasIAMChanges) {
      context.riskSignals.touchesIAM = true;
      if (iamAnalysis.riskLevel === "critical") context.riskSignals.hasIAMCritical = true;
    }

    if (firewallResult.blocked) {
      decision = {
        decision: "DENY",
        reason: `Agent firewall violation: ${firewallResult.violations[0]?.reason}`,
        policy: "hermes.firewall",
        severity: "critical",
        remediationSteps: [
          "The agent does not have sufficient permissions for this action",
          "Request a human operator to perform this action",
          `Agent tier: ${firewallResult.violations[0]?.agentTier} — required: ${firewallResult.violations[0]?.requiredTier}`,
        ],
        riskScore: 100,
        policiesLoaded: [],
        timestamp: new Date().toISOString(),
        contextSha: context.sha,
        actor: context.actor,
        branch: context.branch,
      };
    } else {
      decision = evaluateWithOPA(context);
    }

    console.log("=== HERMES DECISION ===");
    console.log(JSON.stringify(decision, null, 2));
    console.log("");
  } catch (err) {
    console.error("❌ Policy evaluation failed:", err.message);
    process.exit(1);
  }

  try {
    context.heatmap = heatmap;
    context.iamAnalysis = iamAnalysis;
    await postDecisionComment(decision, context);
  } catch (err) {
    console.warn("⚠️  PR comment failed (non-fatal):", err.message);
  }

  try {
    const summaryFile = process.env.GITHUB_STEP_SUMMARY;
    if (summaryFile) {
      const fs = require("fs");
      const statusIcon = { ALLOW: "✅", WARN: "⚠️", DENY: "❌" }[decision.decision];
      let summary = `## ${statusIcon} Hermes v3 — ${decision.decision}\n\n`;
      summary += `**${decision.reason}**\n\n`;
      summary += heatmap.markdownTable;
      if (iamAnalysis.hasIAMChanges && iamAnalysis.findings.length > 0) {
        summary += `\n### IAM Findings\n\n`;
        iamAnalysis.findings.forEach((f) => {
          summary += `- **[${f.severity.toUpperCase()}]** ${f.message}\n`;
        });
      }
      fs.appendFileSync(summaryFile, summary);
    }
  } catch {
    // Non-fatal
  }

  switch (decision.decision) {
    case "DENY":
      console.error(`\n❌ HERMES BLOCKED PIPELINE`);
      console.error(`   Policy: ${decision.policy}`);
      console.error(`   Reason: ${decision.reason}`);
      if (decision.remediationSteps?.length) {
        console.error(`\n   Remediation:`);
        decision.remediationSteps.forEach((s, i) => console.error(`   ${i + 1}. ${s}`));
      }
      process.exit(1);
      break;
    case "WARN":
      console.warn(`\n⚠️  HERMES WARNING`);
      console.warn(`   Policy: ${decision.policy}`);
      console.warn(`   Reason: ${decision.reason}`);
      console.log("\n✅ Pipeline continues (WARN is non-blocking)");
      process.exit(0);
      break;
    case "ALLOW":
    default:
      console.log(`\n✅ HERMES APPROVED`);
      console.log(`   Policy: ${decision.policy}`);
      console.log(`   Reason: ${decision.reason}`);
      process.exit(0);
      break;
  }
})();

module.exports = { isGovernanceFixtureFile, filterGovernanceFixtureDiff };
