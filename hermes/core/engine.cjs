#!/usr/bin/env node
"use strict";
/**
 * hermes/core/engine.js
 *
 * Hermes v2 Policy Gate — CI Entrypoint
 *
 * Usage:
 *   node hermes/core/engine.js
 *
 * Exit codes:
 *   0 — ALLOW or WARN (pipeline continues)
 *   1 — DENY (pipeline blocked)
 *
 * Environment variables (set automatically by GitHub Actions):
 *   GITHUB_REPOSITORY, GITHUB_REF_NAME, GITHUB_ACTOR,
 *   GITHUB_EVENT_NAME, GITHUB_RUN_ID, GITHUB_SHA
 */

const { buildContext } = require("../context/github-context.cjs");
const { evaluateWithOPA } = require("./opa.cjs");

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║        HERMES v2 POLICY GATE             ║");
  console.log("╚══════════════════════════════════════════╝\n");

  // Step 1: Build context
  let context;
  try {
    context = buildContext();
  } catch (err) {
    console.error("❌ HERMES ERROR: Failed to build context:", err.message);
    process.exit(1);
  }

  console.log("=== CONTEXT ===");
  console.log(JSON.stringify(context, null, 2));
  console.log("");

  // Step 2: Evaluate policy
  let result;
  try {
    result = evaluateWithOPA(context);
  } catch (err) {
    console.error("❌ HERMES ERROR: Policy evaluation failed:", err.message);
    process.exit(1);
  }

  console.log("=== DECISION ===");
  console.log(JSON.stringify(result, null, 2));
  console.log("");

  // Step 3: Enforce decision
  switch (result.decision) {
    case "DENY":
      console.error(`❌ BLOCKED by ${result.policy}: ${result.reason}`);
      process.exit(1);
      break;

    case "WARN":
      console.warn(`⚠️  WARNING from ${result.policy}: ${result.reason}`);
      console.log("✅ Pipeline continues (WARN is non-blocking)");
      process.exit(0);
      break;

    case "ALLOW":
    default:
      console.log(`✅ APPROVED by ${result.policy}: ${result.reason}`);
      process.exit(0);
      break;
  }
})();
