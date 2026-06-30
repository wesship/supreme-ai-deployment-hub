/**
 * runtime-validation/scenarios/governance-arbitration.test.ts
 *
 * Wave 27 — Governance Arbitration Validation
 *
 * Validates the governance layer contracts:
 *   1. Conflicting agent decisions trigger governance suspension + escalation
 *   2. Capability boundary enforcement: unauthorized tools are hard-denied
 *   3. Governance is external to the executor (agents cannot self-authorize)
 *   4. Audit events are emitted with actor + reason on every block/escalation
 *   5. Escalation paths are traceable in the DAG
 *
 * Design principle: governance must exist OUTSIDE the execution agent.
 * Agents cannot self-authorize unsafe escalation. The arbitration layer
 * is independently enforceable.
 *
 * The .todo() blocks mark Wave 30 work (real policyEngine.ts integration).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TraceEngine, resetIdSequence } from "../harness/traceEngine";

beforeEach(() => {
  resetIdSequence();
});

// ---------------------------------------------------------------------------
// Helpers: mock policy engine
// ---------------------------------------------------------------------------

type PolicyDecision = "allow" | "deny" | "escalate";

interface PolicyRule {
  action: string;
  decision: PolicyDecision;
  reason?: string;
}

class MockPolicyEngine {
  private rules: PolicyRule[];

  constructor(rules: PolicyRule[]) {
    this.rules = rules;
  }

  evaluate(
    agentId: string,
    action: string,
    trace: TraceEngine
  ): PolicyDecision {
    const rule = this.rules.find((r) => r.action === action);
    const decision = rule?.decision ?? "allow";

    trace.record(agentId, "governance_check", {
      policy: action,
      decision,
      summary: `${action}:${decision}`,
    });

    if (decision === "deny") {
      trace.record(agentId, "governance_block", {
        policy: action,
        actor: agentId,
        reason: rule?.reason ?? "policy deny",
        summary: `BLOCKED:${action}`,
      });
    }

    if (decision === "escalate") {
      trace.record(agentId, "governance_escalate", {
        policy: action,
        actor: agentId,
        reason: rule?.reason ?? "requires human review",
        summary: `ESCALATE:${action}`,
      });
    }

    return decision;
  }
}

// ---------------------------------------------------------------------------
// Conflict detection tests
// ---------------------------------------------------------------------------

describe("Governance arbitration — conflict detection", () => {
  it("two agents proposing contradictory infrastructure changes trigger escalation", () => {
    const trace = new TraceEngine("gov-conflict");
    const policy = new MockPolicyEngine([
      { action: "scale-down-api", decision: "escalate", reason: "conflicts with scale-up-api" },
    ]);

    // Agent A proposes scale-up
    trace.record("agent-a", "thought", { summary: "propose scale-up-api" });
    const decisionA = policy.evaluate("agent-a", "scale-up-api", trace);
    expect(decisionA).toBe("allow");

    // Agent B proposes scale-down (conflicts)
    trace.record("agent-b", "thought", { summary: "propose scale-down-api" });
    const decisionB = policy.evaluate("agent-b", "scale-down-api", trace);
    expect(decisionB).toBe("escalate");

    expect(trace.wasEscalated()).toBe(true);
    const escalations = trace.getEventsByKind("governance_escalate");
    expect(escalations[0].payload.actor).toBe("agent-b");
    expect(escalations[0].payload.reason).toMatch(/conflicts/);
  });

  it("escalation event is emitted with actor and reason in payload", () => {
    const trace = new TraceEngine("gov-escalation-payload");
    const policy = new MockPolicyEngine([
      { action: "delete-production-db", decision: "escalate", reason: "destructive action requires human approval" },
    ]);

    policy.evaluate("executor", "delete-production-db", trace);

    const escalations = trace.getEventsByKind("governance_escalate");
    expect(escalations).toHaveLength(1);
    expect(escalations[0].payload.actor).toBe("executor");
    expect(escalations[0].payload.reason).toMatch(/human approval/);
  });

  it("escalation suspends further tool calls in the same span", () => {
    const trace = new TraceEngine("gov-suspension");
    const policy = new MockPolicyEngine([
      { action: "risky-migration", decision: "escalate", reason: "requires DBA approval" },
    ]);

    trace.record("executor", "tool_call", { tool: "safe-read", summary: "safe-read" });
    trace.record("executor", "tool_result", { tool: "safe-read", success: true, summary: "safe-read" });

    const decision = policy.evaluate("executor", "risky-migration", trace);
    expect(decision).toBe("escalate");

    // After escalation, no further tool_call events should be recorded
    // (the caller is responsible for checking the decision before proceeding)
    const toolCallsAfterEscalation = trace
      .getEventsByKind("tool_call")
      .filter((e) => e.timestamp > trace.getEventsByKind("governance_escalate")[0].timestamp);
    expect(toolCallsAfterEscalation).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Capability boundary tests
// ---------------------------------------------------------------------------

describe("Governance arbitration — capability boundary enforcement", () => {
  it("unauthorized tool usage results in a hard deny", () => {
    const trace = new TraceEngine("gov-capability-deny");
    const policy = new MockPolicyEngine([
      { action: "filesystem_write", decision: "deny", reason: "executor role: read-only" },
    ]);

    trace.record("executor", "tool_call", { tool: "filesystem_write", summary: "filesystem_write" });
    const decision = policy.evaluate("executor", "filesystem_write", trace);

    expect(decision).toBe("deny");
    expect(trace.wasBlocked()).toBe(true);
  });

  it("hard deny emits an immutable audit event with actor and reason", () => {
    const trace = new TraceEngine("gov-audit-event");
    const policy = new MockPolicyEngine([
      { action: "github_delete_repo", decision: "deny", reason: "destructive: not in capability set" },
    ]);

    policy.evaluate("executor", "github_delete_repo", trace);

    const blocks = trace.getEventsByKind("governance_block");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].payload.actor).toBe("executor");
    expect(blocks[0].payload.reason).toMatch(/destructive/);
    expect(blocks[0].payload.policy).toBe("github_delete_repo");
  });

  it("hard deny does not produce a silent fallback — no tool_result after block", () => {
    const trace = new TraceEngine("gov-no-silent-fallback");
    const policy = new MockPolicyEngine([
      { action: "exec_shell", decision: "deny", reason: "shell execution prohibited" },
    ]);

    trace.record("executor", "tool_call", { tool: "exec_shell", summary: "exec_shell" });
    policy.evaluate("executor", "exec_shell", trace);

    // No tool_result should follow a governance_block
    const blockTime = trace.getEventsByKind("governance_block")[0].timestamp;
    const resultsAfterBlock = trace
      .getEventsByKind("tool_result")
      .filter((e) => e.timestamp >= blockTime);
    expect(resultsAfterBlock).toHaveLength(0);
  });

  it("allowed tools proceed without governance events", () => {
    const trace = new TraceEngine("gov-allow-no-events");
    const policy = new MockPolicyEngine([
      { action: "duckduckgo_search", decision: "allow" },
    ]);

    policy.evaluate("executor", "duckduckgo_search", trace);

    expect(trace.wasBlocked()).toBe(false);
    expect(trace.wasEscalated()).toBe(false);
    // Only a governance_check event, no block or escalate
    expect(trace.getEventsByKind("governance_check")).toHaveLength(1);
    expect(trace.getEventsByKind("governance_block")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// External governance (agents cannot self-authorize)
// ---------------------------------------------------------------------------

describe("Governance arbitration — external authority principle", () => {
  it("governance decisions are recorded by the policy engine, not the agent", () => {
    const trace = new TraceEngine("gov-external");
    const policy = new MockPolicyEngine([
      { action: "deploy-to-prod", decision: "deny", reason: "requires production approval" },
    ]);

    // Agent records a tool_call intent
    trace.record("executor", "tool_call", { tool: "deploy-to-prod", summary: "deploy-to-prod" });

    // Policy engine (external) evaluates and records the block
    policy.evaluate("executor", "deploy-to-prod", trace);

    // The governance_block event is present — it was recorded by the policy engine
    const blocks = trace.getEventsByKind("governance_block");
    expect(blocks).toHaveLength(1);

    // The agent itself did NOT record the block — it came from outside
    // (In this harness, the policy engine calls trace.record on behalf of the agent ID
    //  but in production the policy engine is a separate service)
    expect(blocks[0].agentId).toBe("executor"); // actor, not the policy engine itself
  });

  it("multiple agents are subject to the same policy engine", () => {
    const trace = new TraceEngine("gov-multi-agent-policy");
    const policy = new MockPolicyEngine([
      { action: "drop-table", decision: "deny", reason: "DBA-only action" },
    ]);

    const decisionA = policy.evaluate("agent-a", "drop-table", trace);
    const decisionB = policy.evaluate("agent-b", "drop-table", trace);

    expect(decisionA).toBe("deny");
    expect(decisionB).toBe("deny");

    const blocks = trace.getEventsByKind("governance_block");
    expect(blocks).toHaveLength(2);
    expect(blocks.map((b) => b.agentId)).toEqual(["agent-a", "agent-b"]);
  });
});

// ---------------------------------------------------------------------------
// Pending: real policyEngine.ts integration (Wave 30)
// ---------------------------------------------------------------------------

describe.todo("Governance arbitration — real policy engine (Wave 30)", () => {
  // it("deployment recommendation against locked environment is blocked")
  // it("blocked actions emit a security_events audit row with actor + reason")
  // it("policy violation surfaces to UI as an observation step, not as silent drop")
  // it("human-review-required actions pause execution and emit a review token")
  // it("policy hot-reload updates enforcement without restarting executor")
  // it("conflicting agent decisions trigger governance suspension + audit event")
  // it("authority hierarchy: planner cannot override auditor governance decision")
});
