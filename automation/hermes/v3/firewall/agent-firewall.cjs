"use strict";
/**
 * hermes/v3/firewall/agent-firewall.cjs
 *
 * Hermes v3 — D3VONN Agent Execution Firewall
 *
 * Controls what autonomous agents are permitted to do in the CI/CD pipeline.
 * Prevents agent-initiated changes from bypassing human governance controls.
 *
 * Architecture:
 *   - Each agent has a declared execution mode and permission tier
 *   - The firewall evaluates the agent's requested action against its tier
 *   - Actions outside the permitted tier are blocked with an explanation
 *
 * Permission tiers (ascending privilege):
 *   read-only    — Can read repo state, cannot write or deploy
 *   contributor  — Can open PRs, cannot merge or deploy
 *   deployer     — Can deploy to staging, cannot deploy to production
 *   operator     — Can deploy to production with human approval
 *   admin        — Full access (reserved for platform team only)
 *
 * Agent IDs are defined in DEVONN_AGENT_REGISTRY (environment variable or
 * the registry file at hermes/v3/firewall/agent-registry.json).
 */

const fs = require("fs");
const path = require("path");

// Default permission tiers for known D3VONN agent types
const DEFAULT_AGENT_TIERS = {
  "d3vonn-copilot":        "contributor",
  "d3vonn-deployer":       "deployer",
  "d3vonn-security-bot":   "read-only",
  "d3vonn-release-bot":    "deployer",
  "github-actions[bot]":   "deployer",
  "dependabot[bot]":       "contributor",
  "unknown":               "read-only",
};

// Actions and their required minimum permission tier
const ACTION_TIER_REQUIREMENTS = {
  "read_repo":             "read-only",
  "open_pr":               "contributor",
  "comment_pr":            "contributor",
  "merge_pr":              "operator",
  "deploy_staging":        "deployer",
  "deploy_production":     "operator",
  "modify_iam":            "admin",
  "modify_workflows":      "operator",
  "rotate_secrets":        "operator",
  "create_release":        "deployer",
};

const TIER_LEVELS = {
  "read-only":   1,
  "contributor": 2,
  "deployer":    3,
  "operator":    4,
  "admin":       5,
};

/**
 * Load the agent registry from a JSON file or environment variable.
 * @returns {object} Map of agentId → tier
 */
function loadAgentRegistry() {
  // Try environment variable first (JSON string)
  if (process.env.DEVONN_AGENT_REGISTRY) {
    try {
      return JSON.parse(process.env.DEVONN_AGENT_REGISTRY);
    } catch {
      // Fall through to file
    }
  }

  // Try registry file
  const registryPath = path.join(__dirname, "agent-registry.json");
  if (fs.existsSync(registryPath)) {
    try {
      return JSON.parse(fs.readFileSync(registryPath, "utf-8"));
    } catch {
      // Fall through to defaults
    }
  }

  return DEFAULT_AGENT_TIERS;
}

/**
 * Get the permission tier for a given agent ID.
 * @param {string} agentId
 * @param {object} registry
 * @returns {string} tier
 */
function getAgentTier(agentId, registry) {
  return registry[agentId] || registry["unknown"] || "read-only";
}

/**
 * Check if a tier level meets the minimum required level.
 * @param {string} agentTier
 * @param {string} requiredTier
 * @returns {boolean}
 */
function tierMeetsRequirement(agentTier, requiredTier) {
  return (TIER_LEVELS[agentTier] || 0) >= (TIER_LEVELS[requiredTier] || 999);
}

/**
 * Evaluate whether an agent is permitted to perform an action.
 *
 * @param {object} agentContext - From context.agentContext
 * @param {string} requestedAction - One of the keys in ACTION_TIER_REQUIREMENTS
 * @returns {{ permitted: boolean, reason: string, agentTier: string, requiredTier: string }}
 */
function evaluateAgentAction(agentContext, requestedAction) {
  const registry = loadAgentRegistry();
  const agentId = agentContext?.agentId || agentContext?.actor || "unknown";
  const agentTier = getAgentTier(agentId, registry);
  const requiredTier = ACTION_TIER_REQUIREMENTS[requestedAction] || "admin";

  const permitted = tierMeetsRequirement(agentTier, requiredTier);

  return {
    permitted,
    agentId,
    agentTier,
    requiredTier,
    requestedAction,
    reason: permitted
      ? `Agent '${agentId}' (tier: ${agentTier}) is permitted to '${requestedAction}'`
      : `Agent '${agentId}' (tier: ${agentTier}) is NOT permitted to '${requestedAction}' — requires tier '${requiredTier}'`,
  };
}

/**
 * Evaluate all actions implied by the Hermes context against the agent firewall.
 * Used by the engine to add firewall checks to the decision pipeline.
 *
 * @param {object} context - Hermes v3 context
 * @returns {{ blocked: boolean, violations: Array }}
 */
function evaluateContextFirewall(context) {
  if (!context.agentContext?.isAgentActor) {
    // Human actor — firewall does not apply
    return { blocked: false, violations: [], isAgentActor: false };
  }

  const violations = [];
  const s = context.riskSignals || {};

  // Map risk signals to implied actions
  const impliedActions = [];
  if (s.touchesIAM)       impliedActions.push("modify_iam");
  if (s.touchesWorkflows) impliedActions.push("modify_workflows");
  if (context.branch === "main") impliedActions.push("merge_pr");

  for (const action of impliedActions) {
    const result = evaluateAgentAction(context.agentContext, action);
    if (!result.permitted) {
      violations.push(result);
    }
  }

  return {
    blocked: violations.length > 0,
    violations,
    isAgentActor: true,
    agentId: context.agentContext.agentId || context.actor,
  };
}

module.exports = {
  evaluateAgentAction,
  evaluateContextFirewall,
  getAgentTier,
  loadAgentRegistry,
  ACTION_TIER_REQUIREMENTS,
  TIER_LEVELS,
};
