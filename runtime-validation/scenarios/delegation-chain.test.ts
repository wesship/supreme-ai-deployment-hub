/**
 * runtime-validation/scenarios/delegation-chain.test.ts
 *
 * Wave 27 — Delegation Chain Validation
 *
 * Validates the planner → executor → auditor delegation contract using the
 * TraceEngine. These tests do NOT call production code — they exercise the
 * harness itself and pin the trace shape that the real orchestration layer
 * must produce when it is wired in.
 *
 * Assertions:
 *   1. Agent lineage is recorded in delegation order
 *   2. Each delegation emits a "delegation" event with correct from/to
 *   3. Child spans are nested under parent spans in the DAG
 *   4. The auditor receives a governance_check event after execution
 *   5. A governance_block prevents downstream tool calls
 *   6. Correlation IDs are consistent across the entire chain
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TraceEngine, resetIdSequence } from "../harness/traceEngine";

beforeEach(() => {
  resetIdSequence();
});

// ---------------------------------------------------------------------------
// Helper: simulate a planner → executor → auditor chain
// ---------------------------------------------------------------------------

function runDelegationChain(trace: TraceEngine, opts: {
  blockAtGovernance?: boolean;
} = {}) {
  // 1. Planner starts
  trace.record("planner", "agent_start", { goal: "deploy service v2" });
  trace.record("planner", "thought", { summary: "Decompose goal into subtasks" });

  // 2. Planner delegates to executor
  trace.record("planner", "delegation", {
    targetAgentId: "executor",
    summary: "Execute deployment steps",
  });
  trace.pushSpan();

  // 3. Executor runs
  trace.record("executor", "agent_start", { task: "run deployment" });
  trace.record("executor", "tool_call", { tool: "kubectl_apply", summary: "kubectl_apply" });
  trace.record("executor", "tool_result", { tool: "kubectl_apply", success: true, summary: "kubectl_apply" });

  // 4. Governance check before executor completes
  trace.record("executor", "governance_check", {
    policy: "deployment-gate",
    action: "kubectl_apply",
    summary: "deployment-gate",
  });

  if (opts.blockAtGovernance) {
    trace.record("executor", "governance_block", {
      policy: "deployment-gate",
      reason: "environment locked",
      summary: "deployment-gate BLOCKED",
    });
    trace.popSpan();
    return;
  }

  trace.record("executor", "agent_stop", { summary: "deployment complete" });
  trace.popSpan();

  // 5. Planner delegates to auditor
  trace.record("planner", "delegation", {
    targetAgentId: "auditor",
    summary: "Verify deployment outcome",
  });
  trace.pushSpan();

  trace.record("auditor", "agent_start", { task: "audit deployment" });
  trace.record("auditor", "governance_check", {
    policy: "post-deploy-audit",
    summary: "post-deploy-audit",
  });
  trace.record("auditor", "observation", { summary: "Deployment verified: 3/3 pods healthy" });
  trace.record("auditor", "agent_stop", { summary: "audit complete" });
  trace.popSpan();

  trace.record("planner", "agent_stop", { summary: "goal achieved" });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Delegation chain — trace structure", () => {
  it("records agent lineage in planner → executor → auditor order", () => {
    const trace = new TraceEngine("chain-lineage");
    runDelegationChain(trace);
    expect(trace.getAgentLineage()).toEqual(["planner", "executor", "auditor"]);
  });

  it("emits exactly 2 delegation events with correct from/to pairs", () => {
    const trace = new TraceEngine("chain-delegations");
    runDelegationChain(trace);
    const chains = trace.getDelegationChains();
    expect(chains).toHaveLength(2);
    expect(chains[0]).toMatchObject({ from: "planner", to: "executor" });
    expect(chains[1]).toMatchObject({ from: "planner", to: "auditor" });
  });

  it("all events share the same runId (correlation ID consistency)", () => {
    const trace = new TraceEngine("chain-correlation");
    runDelegationChain(trace);
    const runIds = new Set(trace.allEvents().map((e) => e.runId));
    expect(runIds.size).toBe(1);
    expect([...runIds][0]).toBe("chain-correlation");
  });

  it("executor events carry a child spanId distinct from planner root span", () => {
    const trace = new TraceEngine("chain-spans");
    runDelegationChain(trace);
    const plannerSpans = new Set(
      trace.getEventsByAgent("planner").map((e) => e.spanId)
    );
    const executorSpans = new Set(
      trace.getEventsByAgent("executor").map((e) => e.spanId)
    );
    // Executor must have its own span
    const overlap = [...executorSpans].filter((s) => plannerSpans.has(s));
    expect(overlap).toHaveLength(0);
  });

  it("auditor emits a governance_check event after executor completes", () => {
    const trace = new TraceEngine("chain-audit");
    runDelegationChain(trace);
    const govEvents = trace.getGovernanceEvents();
    const auditorGov = govEvents.filter((e) => e.agentId === "auditor");
    expect(auditorGov.length).toBeGreaterThan(0);
    expect(auditorGov[0].kind).toBe("governance_check");
  });

  it("DAG root node is the planner", () => {
    const trace = new TraceEngine("chain-dag");
    runDelegationChain(trace);
    const dag = trace.buildDAG();
    expect(dag.root.agentId).toBe("planner");
  });

  it("DAG has child nodes for executor and auditor spans", () => {
    const trace = new TraceEngine("chain-dag-children");
    runDelegationChain(trace);
    const dag = trace.buildDAG();
    // Root should have at least 2 child spans (executor + auditor)
    expect(dag.root.children.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Delegation chain — governance block", () => {
  it("governance_block prevents auditor delegation (chain stops at block)", () => {
    const trace = new TraceEngine("chain-blocked");
    runDelegationChain(trace, { blockAtGovernance: true });

    expect(trace.wasBlocked()).toBe(true);
    // Auditor should NOT appear in lineage
    expect(trace.getAgentLineage()).not.toContain("auditor");
  });

  it("governance_block emits an event with policy and reason in payload", () => {
    const trace = new TraceEngine("chain-block-payload");
    runDelegationChain(trace, { blockAtGovernance: true });

    const blocks = trace.getEventsByKind("governance_block");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].payload.policy).toBe("deployment-gate");
    expect(blocks[0].payload.reason).toBe("environment locked");
  });

  it("no tool_result events appear after a governance_block", () => {
    const trace = new TraceEngine("chain-block-no-results");
    runDelegationChain(trace, { blockAtGovernance: true });

    const blockTime = trace.getEventsByKind("governance_block")[0]?.timestamp;
    const lateResults = trace
      .getEventsByKind("tool_result")
      .filter((e) => e.timestamp > (blockTime ?? ""));
    expect(lateResults).toHaveLength(0);
  });
});

describe("Delegation chain — replay determinism", () => {
  it("two identical runs produce the same agent lineage and delegation count", () => {
    const trace1 = new TraceEngine("replay-1");
    runDelegationChain(trace1);

    resetIdSequence();
    const trace2 = new TraceEngine("replay-2");
    runDelegationChain(trace2);

    expect(trace1.getAgentLineage()).toEqual(trace2.getAgentLineage());
    expect(trace1.getDelegationChains().length).toBe(
      trace2.getDelegationChains().length
    );
    expect(trace1.allEvents().length).toBe(trace2.allEvents().length);
  });
});
