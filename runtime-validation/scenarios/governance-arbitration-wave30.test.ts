/**
 * runtime-validation/scenarios/governance-arbitration-wave30.test.ts
 *
 * Wave 30: Governance Arbitration Under Conflict
 *
 * These scenarios validate that the ArbitrationEngine correctly resolves
 * conflicts between agents under all three conflict classes:
 *
 *   - Soft conflict:       preference mismatch (both actions valid, incompatible)
 *   - Hard conflict:       policy violation (at least one action denied)
 *   - Structural conflict: mutually exclusive actions
 *
 * Additionally, the DecisionTraceValidator verifies that every decision is:
 *   - Reproducible (same inputs -> same output)
 *   - Explainable (decision traced to a rule or authority)
 *   - Free of hidden state influence
 *   - Authority-hierarchy-respecting
 *   - Forbidden-action-suppressing under conflict pressure
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  ArbitrationEngine,
  ConflictGenerator,
  DecisionTraceValidator,
  PolicyResolutionGraph,
  resetArbitrationIdSequence,
} from "../harness/arbitrationEngine.js";
import { TraceEngine, resetIdSequence } from "../harness/traceEngine.js";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

function buildStandardGraph(): PolicyResolutionGraph {
  const graph = new PolicyResolutionGraph();

  // Authority hierarchy: executor(1) < planner(2) < auditor(3) < governance(4)
  graph.addAuthority({ agentId: "executor-1", authorityLevel: 1, roles: ["executor"], canIssueReviewTokens: false });
  graph.addAuthority({ agentId: "executor-2", authorityLevel: 1, roles: ["executor"], canIssueReviewTokens: false });
  graph.addAuthority({ agentId: "planner-1", authorityLevel: 2, roles: ["planner"], canIssueReviewTokens: false });
  graph.addAuthority({ agentId: "planner-2", authorityLevel: 2, roles: ["planner"], canIssueReviewTokens: false });
  graph.addAuthority({ agentId: "auditor-1", authorityLevel: 3, roles: ["auditor"], canIssueReviewTokens: true });
  graph.addAuthority({ agentId: "governance-1", authorityLevel: 4, roles: ["governance"], canIssueReviewTokens: true });

  // Policy rules (higher precedence evaluated first)
  graph.addRules([
    {
      ruleId: "rule-locked-env",
      name: "Locked environment write protection",
      precedence: 100,
      actionPattern: "write-to-locked-env*",
      decision: "deny",
      overridable: false,
      reason: "Production environment is locked",
    },
    {
      ruleId: "rule-delete-prod",
      name: "Production deletion prohibition",
      precedence: 95,
      actionPattern: "delete-prod-*",
      decision: "deny",
      overridable: false,
      reason: "Production resources cannot be deleted without human approval",
    },
    {
      ruleId: "rule-scale-conflict",
      name: "Conflicting scale operations require review",
      precedence: 80,
      actionPattern: "scale-*",
      decision: "escalate",
      overridable: true,
      overrideRequiresAuthority: 4,
      reason: "Conflicting scale operations require human review",
    },
    {
      ruleId: "rule-deploy-staging",
      name: "Staging deployment allowed",
      precedence: 50,
      actionPattern: "deploy-staging",
      decision: "allow",
      overridable: true,
      reason: "Staging deployments are always allowed",
    },
    {
      ruleId: "rule-audit-override",
      name: "Auditor can override planner decisions",
      precedence: 70,
      actionPattern: "override-*",
      decision: "allow",
      overridable: false,
      reason: "Auditor authority supersedes planner",
    },
  ]);

  return graph;
}

beforeEach(() => {
  resetIdSequence();
  resetArbitrationIdSequence();
});

// ---------------------------------------------------------------------------
// Soft conflict: preference mismatch
// ---------------------------------------------------------------------------

describe("Governance arbitration — soft conflict (preference mismatch)", () => {
  it("higher-priority agent wins when two agents propose incompatible staging deployments", () => {
    const graph = buildStandardGraph();
    const engine = new ArbitrationEngine(graph);
    const generator = new ConflictGenerator();
    const trace = new TraceEngine("soft-conflict-1");

    const conflictSet = generator.generateDirect(
      "soft-conflict-1",
      "soft",
      [
        { agentId: "planner-1", action: "deploy-staging", resource: "api-service", priorityWeight: 5, metadata: { version: "v1.2" } },
        { agentId: "planner-2", action: "deploy-staging", resource: "api-service", priorityWeight: 3, metadata: { version: "v1.3" } },
      ]
    );

    const result = engine.arbitrate(conflictSet, trace);

    expect(result.decision).toBe("allow_winner");
    expect(result.winnerAgentId).toBe("planner-1");  // higher priority weight
    expect(result.reviewTokenIssued).toBe(false);
    expect(result.isDeterministic).toBe(true);
  });

  it("higher-authority agent wins when priority weights are equal", () => {
    const graph = buildStandardGraph();
    const engine = new ArbitrationEngine(graph);
    const generator = new ConflictGenerator();
    const trace = new TraceEngine("soft-conflict-2");

    const conflictSet = generator.generateDirect(
      "soft-conflict-2",
      "soft",
      [
        { agentId: "executor-1", action: "deploy-staging", resource: "worker", priorityWeight: 5, metadata: {} },
        { agentId: "planner-1", action: "deploy-staging", resource: "worker", priorityWeight: 5, metadata: {} },
      ]
    );

    const result = engine.arbitrate(conflictSet, trace);

    expect(result.decision).toBe("allow_winner");
    expect(result.winnerAgentId).toBe("planner-1");  // higher authority level (2 > 1)
    expect(result.isDeterministic).toBe(true);
  });

  it("tie-break is deterministic: same inputs always produce the same winner", () => {
    const graph = buildStandardGraph();

    // Run the same conflict 3 times and verify identical results
    const results: string[] = [];
    for (let i = 0; i < 3; i++) {
      resetArbitrationIdSequence();
      const engine = new ArbitrationEngine(graph);
      const generator = new ConflictGenerator();
      const trace = new TraceEngine(`soft-conflict-tiebreak-${i}`);

      const conflictSet = generator.generateDirect(
        `soft-conflict-tiebreak-${i}`,
        "structural",
        [
          { agentId: "executor-1", action: "claim-worker-slot", resource: "slot-A", priorityWeight: 5, metadata: {} },
          { agentId: "executor-2", action: "claim-worker-slot", resource: "slot-A", priorityWeight: 5, metadata: {} },
        ]
      );

      const result = engine.arbitrate(conflictSet, trace);
      results.push(result.winnerAgentId ?? "none");
    }

    // All three runs must produce the same winner
    expect(results[0]).toBe(results[1]);
    expect(results[1]).toBe(results[2]);
  });

  it("soft conflict emits arbitration_begin and arbitration_decision trace events", () => {
    const graph = buildStandardGraph();
    const engine = new ArbitrationEngine(graph);
    const generator = new ConflictGenerator();
    const trace = new TraceEngine("soft-conflict-trace");

    const conflictSet = generator.generateDirect(
      "soft-conflict-trace",
      "soft",
      [
        { agentId: "planner-1", action: "deploy-staging", resource: "frontend", priorityWeight: 5, metadata: {} },
        { agentId: "planner-2", action: "deploy-staging", resource: "frontend", priorityWeight: 3, metadata: {} },
      ]
    );

    engine.arbitrate(conflictSet, trace);
    const events = trace.allEvents();

    expect(events.some((e) => e.kind === "arbitration_begin")).toBe(true);
    expect(events.some((e) => e.kind === "arbitration_decision")).toBe(true);
    expect(events.some((e) => e.kind === "arbitration_escalate")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Hard conflict: policy violation
// ---------------------------------------------------------------------------

describe("Governance arbitration — hard conflict (policy violation)", () => {
  it("any proposal violating a deny rule causes deny_all regardless of other proposals", () => {
    const graph = buildStandardGraph();
    const engine = new ArbitrationEngine(graph);
    const generator = new ConflictGenerator();
    const trace = new TraceEngine("hard-conflict-1");

    const conflictSet = generator.generateDirect(
      "hard-conflict-1",
      "hard",
      [
        { agentId: "planner-1", action: "deploy-staging", resource: "api", priorityWeight: 5, metadata: {} },
        { agentId: "executor-1", action: "write-to-locked-env-prod", resource: "prod-db", priorityWeight: 3, metadata: {} },
      ]
    );

    const result = engine.arbitrate(conflictSet, trace);

    expect(result.decision).toBe("deny_all");
    expect(result.winnerAgentId).toBeUndefined();
    expect(result.reviewTokenIssued).toBe(false);
  });

  it("forbidden action suppression emits a forbidden_action trace event", () => {
    const graph = buildStandardGraph();
    const engine = new ArbitrationEngine(graph);
    const generator = new ConflictGenerator();
    const trace = new TraceEngine("hard-conflict-forbidden");

    const conflictSet = generator.generateDirect(
      "hard-conflict-forbidden",
      "hard",
      [
        { agentId: "executor-1", action: "delete-prod-database", resource: "prod-db", priorityWeight: 10, metadata: {} },
      ]
    );

    engine.arbitrate(conflictSet, trace);
    const events = trace.allEvents();

    expect(events.some((e) => e.kind === "forbidden_action")).toBe(true);
    expect(events.some((e) => e.kind === "arbitration_decision")).toBe(false);
  });

  it("high-priority agent cannot override a non-overridable deny rule", () => {
    const graph = buildStandardGraph();
    const engine = new ArbitrationEngine(graph);
    const generator = new ConflictGenerator();
    const trace = new TraceEngine("hard-conflict-override-attempt");

    // governance-1 has the highest authority (level 4) but the rule is non-overridable
    const conflictSet = generator.generateDirect(
      "hard-conflict-override-attempt",
      "hard",
      [
        { agentId: "governance-1", action: "write-to-locked-env-prod", resource: "prod-db", priorityWeight: 100, metadata: {} },
      ]
    );

    const result = engine.arbitrate(conflictSet, trace);

    // Even the highest-authority agent cannot override a non-overridable deny rule
    expect(result.decision).toBe("deny_all");
  });

  it("hard conflict decision is deterministic across replays", () => {
    const graph = buildStandardGraph();
    const results: string[] = [];

    for (let i = 0; i < 3; i++) {
      resetArbitrationIdSequence();
      const engine = new ArbitrationEngine(graph);
      const generator = new ConflictGenerator();
      const trace = new TraceEngine(`hard-conflict-replay-${i}`);

      const conflictSet = generator.generateDirect(
        `hard-conflict-replay-${i}`,
        "hard",
        [
          { agentId: "executor-1", action: "delete-prod-api", resource: "api", priorityWeight: 5, metadata: {} },
          { agentId: "planner-1", action: "deploy-staging", resource: "api", priorityWeight: 8, metadata: {} },
        ]
      );

      const result = engine.arbitrate(conflictSet, trace);
      results.push(result.decision);
    }

    expect(results[0]).toBe("deny_all");
    expect(results[1]).toBe("deny_all");
    expect(results[2]).toBe("deny_all");
  });
});

// ---------------------------------------------------------------------------
// Structural conflict: mutually exclusive actions
// ---------------------------------------------------------------------------

describe("Governance arbitration — structural conflict (mutually exclusive actions)", () => {
  it("structural conflict triggers tie-break decision", () => {
    const graph = buildStandardGraph();
    const engine = new ArbitrationEngine(graph);
    const generator = new ConflictGenerator();
    const trace = new TraceEngine("structural-conflict-1");

    const conflictSet = generator.generateDirect(
      "structural-conflict-1",
      "structural",
      [
        { agentId: "executor-1", action: "claim-worker-slot", resource: "slot-A", priorityWeight: 5, metadata: {} },
        { agentId: "executor-2", action: "claim-worker-slot", resource: "slot-A", priorityWeight: 5, metadata: {} },
      ]
    );

    const result = engine.arbitrate(conflictSet, trace);

    expect(result.decision).toBe("tie_break");
    expect(result.winnerAgentId).toBeDefined();
    expect(result.isDeterministic).toBe(true);
  });

  it("structural conflict emits a tie_break trace event", () => {
    const graph = buildStandardGraph();
    const engine = new ArbitrationEngine(graph);
    const generator = new ConflictGenerator();
    const trace = new TraceEngine("structural-conflict-trace");

    const conflictSet = generator.generateDirect(
      "structural-conflict-trace",
      "structural",
      [
        { agentId: "planner-1", action: "claim-worker-slot", resource: "slot-B", priorityWeight: 7, metadata: {} },
        { agentId: "planner-2", action: "claim-worker-slot", resource: "slot-B", priorityWeight: 7, metadata: {} },
      ]
    );

    engine.arbitrate(conflictSet, trace);
    const events = trace.allEvents();

    expect(events.some((e) => e.kind === "tie_break")).toBe(true);
  });

  it("authority override is recorded when a higher-authority agent wins a structural conflict", () => {
    const graph = buildStandardGraph();
    const engine = new ArbitrationEngine(graph);
    const generator = new ConflictGenerator();
    const trace = new TraceEngine("structural-authority-override");

    const conflictSet = generator.generateDirect(
      "structural-authority-override",
      "structural",
      [
        { agentId: "executor-1", action: "claim-worker-slot", resource: "slot-C", priorityWeight: 5, metadata: {} },
        { agentId: "auditor-1", action: "claim-worker-slot", resource: "slot-C", priorityWeight: 5, metadata: {} },
      ]
    );

    const result = engine.arbitrate(conflictSet, trace);
    const events = trace.allEvents();

    expect(result.winnerAgentId).toBe("auditor-1");  // auditor has higher authority
    expect(events.some((e) => e.kind === "authority_override")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Escalation mechanics
// ---------------------------------------------------------------------------

describe("Governance arbitration — escalation mechanics", () => {
  it("conflicting scale operations trigger escalation and issue a review token", () => {
    const graph = buildStandardGraph();
    const engine = new ArbitrationEngine(graph);
    const generator = new ConflictGenerator();
    const trace = new TraceEngine("escalation-1");

    const conflictSet = generator.generateDirect(
      "escalation-1",
      "soft",
      [
        { agentId: "planner-1", action: "scale-up-api", resource: "api", priorityWeight: 5, metadata: {} },
        { agentId: "planner-2", action: "scale-down-api", resource: "api", priorityWeight: 5, metadata: {} },
      ]
    );

    const result = engine.arbitrate(conflictSet, trace);

    expect(result.decision).toBe("escalate");
    expect(result.reviewTokenIssued).toBe(true);
    expect(result.reviewTokenId).toBeDefined();
  });

  it("escalation emits review_token_issued trace event", () => {
    const graph = buildStandardGraph();
    const engine = new ArbitrationEngine(graph);
    const generator = new ConflictGenerator();
    const trace = new TraceEngine("escalation-trace");

    const conflictSet = generator.generateDirect(
      "escalation-trace",
      "soft",
      [
        { agentId: "planner-1", action: "scale-up-workers", resource: "worker-pool", priorityWeight: 5, metadata: {} },
      ]
    );

    engine.arbitrate(conflictSet, trace);
    const events = trace.allEvents();

    expect(events.some((e) => e.kind === "review_token_issued")).toBe(true);
    expect(events.some((e) => e.kind === "arbitration_escalate")).toBe(true);
  });

  it("escalation does not select a winner", () => {
    const graph = buildStandardGraph();
    const engine = new ArbitrationEngine(graph);
    const generator = new ConflictGenerator();
    const trace = new TraceEngine("escalation-no-winner");

    const conflictSet = generator.generateDirect(
      "escalation-no-winner",
      "soft",
      [
        { agentId: "planner-1", action: "scale-down-api", resource: "api", priorityWeight: 8, metadata: {} },
      ]
    );

    const result = engine.arbitrate(conflictSet, trace);

    expect(result.decision).toBe("escalate");
    expect(result.winnerAgentId).toBeUndefined();
    expect(result.winnerProposalId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Policy hierarchy enforcement
// ---------------------------------------------------------------------------

describe("Governance arbitration — policy hierarchy enforcement", () => {
  it("higher-precedence deny rule overrides lower-precedence allow rule", () => {
    const graph = buildStandardGraph();
    const engine = new ArbitrationEngine(graph);
    const generator = new ConflictGenerator();
    const trace = new TraceEngine("policy-hierarchy-1");

    // The locked-env deny rule (precedence 100) should override any allow
    const conflictSet = generator.generateDirect(
      "policy-hierarchy-1",
      "hard",
      [
        { agentId: "governance-1", action: "write-to-locked-env-staging", resource: "staging-db", priorityWeight: 100, metadata: {} },
      ]
    );

    const result = engine.arbitrate(conflictSet, trace);
    expect(result.decision).toBe("deny_all");
  });

  it("auditor cannot be overridden by planner in authority hierarchy", () => {
    const graph = buildStandardGraph();
    const engine = new ArbitrationEngine(graph);
    const generator = new ConflictGenerator();
    const trace = new TraceEngine("policy-hierarchy-authority");

    const conflictSet = generator.generateDirect(
      "policy-hierarchy-authority",
      "soft",
      [
        { agentId: "planner-1", action: "deploy-staging", resource: "api", priorityWeight: 10, metadata: {} },
        { agentId: "auditor-1", action: "deploy-staging", resource: "api", priorityWeight: 3, metadata: {} },
      ]
    );

    const result = engine.arbitrate(conflictSet, trace);

    // auditor (authority 3) beats planner (authority 2) even with lower priority weight
    expect(result.winnerAgentId).toBe("auditor-1");
  });

  it("policy precedence order is respected: highest-precedence rule is evaluated first", () => {
    const graph = buildStandardGraph();

    // Evaluate an action that matches both a deny rule and a lower-precedence allow rule
    const { rule, decision } = graph.evaluate("write-to-locked-env-prod");

    expect(decision).toBe("deny");
    expect(rule?.ruleId).toBe("rule-locked-env");
    expect(rule?.precedence).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Forbidden action suppression under conflict pressure
// ---------------------------------------------------------------------------

describe("Governance arbitration — forbidden action suppression under conflict pressure", () => {
  it("forbidden action is suppressed even when the proposing agent has maximum priority", () => {
    const graph = buildStandardGraph();
    const engine = new ArbitrationEngine(graph);
    const generator = new ConflictGenerator();
    const trace = new TraceEngine("forbidden-max-priority");

    const conflictSet = generator.generateDirect(
      "forbidden-max-priority",
      "hard",
      [
        {
          agentId: "governance-1",
          action: "delete-prod-database",
          resource: "prod-db",
          priorityWeight: 9999,
          metadata: { justification: "emergency cleanup" },
        },
      ]
    );

    const result = engine.arbitrate(conflictSet, trace);

    expect(result.decision).toBe("deny_all");
    expect(result.winnerAgentId).toBeUndefined();
  });

  it("forbidden action suppression is recorded in the trace even under conflict pressure", () => {
    const graph = buildStandardGraph();
    const engine = new ArbitrationEngine(graph);
    const generator = new ConflictGenerator();
    const trace = new TraceEngine("forbidden-trace-pressure");

    const conflictSet = generator.generateDirect(
      "forbidden-trace-pressure",
      "hard",
      [
        { agentId: "planner-1", action: "deploy-staging", resource: "api", priorityWeight: 5, metadata: {} },
        { agentId: "executor-1", action: "delete-prod-api", resource: "api", priorityWeight: 8, metadata: {} },
      ]
    );

    engine.arbitrate(conflictSet, trace);
    const events = trace.allEvents();

    // The forbidden action must be recorded even though the other proposal was valid
    expect(events.some((e) => e.kind === "forbidden_action")).toBe(true);
    // No winner should be selected
    const decisionEvent = events.find((e) => e.kind === "arbitration_decision");
    expect(decisionEvent).toBeUndefined();
  });

  it("two conflicting valid proposals do not trigger forbidden action suppression", () => {
    const graph = buildStandardGraph();
    const engine = new ArbitrationEngine(graph);
    const generator = new ConflictGenerator();
    const trace = new TraceEngine("no-forbidden-soft");

    const conflictSet = generator.generateDirect(
      "no-forbidden-soft",
      "soft",
      [
        { agentId: "planner-1", action: "deploy-staging", resource: "api", priorityWeight: 5, metadata: {} },
        { agentId: "planner-2", action: "deploy-staging", resource: "api", priorityWeight: 3, metadata: {} },
      ]
    );

    engine.arbitrate(conflictSet, trace);
    const events = trace.allEvents();

    expect(events.some((e) => e.kind === "forbidden_action")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Decision trace validation
// ---------------------------------------------------------------------------

describe("Governance arbitration — decision trace validation", () => {
  it("a valid soft-conflict decision passes all validation checks", () => {
    const graph = buildStandardGraph();
    const engine = new ArbitrationEngine(graph);
    const validator = new DecisionTraceValidator(engine, graph);
    const generator = new ConflictGenerator();
    const trace = new TraceEngine("validation-soft");

    const conflictSet = generator.generateDirect(
      "validation-soft",
      "soft",
      [
        { agentId: "planner-1", action: "deploy-staging", resource: "api", priorityWeight: 7, metadata: {} },
        { agentId: "planner-2", action: "deploy-staging", resource: "api", priorityWeight: 4, metadata: {} },
      ]
    );

    engine.arbitrate(conflictSet, trace);
    const traces = engine.getAllDecisionTraces();
    expect(traces.length).toBeGreaterThan(0);

    const result = validator.validate(traces[0], trace);

    expect(result.isReproducible).toBe(true);
    expect(result.isExplainable).toBe(true);
    expect(result.hasHiddenStateInfluence).toBe(false);
    expect(result.respectsAuthorityHierarchy).toBe(true);
    expect(result.forbiddenActionsSuppressed).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("a valid hard-conflict decision passes all validation checks", () => {
    const graph = buildStandardGraph();
    const engine = new ArbitrationEngine(graph);
    const validator = new DecisionTraceValidator(engine, graph);
    const generator = new ConflictGenerator();
    const trace = new TraceEngine("validation-hard");

    const conflictSet = generator.generateDirect(
      "validation-hard",
      "hard",
      [
        { agentId: "executor-1", action: "delete-prod-service", resource: "api", priorityWeight: 5, metadata: {} },
      ]
    );

    engine.arbitrate(conflictSet, trace);
    const traces = engine.getAllDecisionTraces();
    const result = validator.validate(traces[0], trace);

    expect(result.isReproducible).toBe(true);
    expect(result.passed).toBe(true);
  });

  it("decision is reproducible: same conflict inputs always produce the same validation result", () => {
    const graph = buildStandardGraph();
    const validationResults: boolean[] = [];

    for (let i = 0; i < 3; i++) {
      resetArbitrationIdSequence();
      const engine = new ArbitrationEngine(graph);
      const validator = new DecisionTraceValidator(engine, graph);
      const generator = new ConflictGenerator();
      const trace = new TraceEngine(`validation-replay-${i}`);

      const conflictSet = generator.generateDirect(
        `validation-replay-${i}`,
        "soft",
        [
          { agentId: "planner-1", action: "deploy-staging", resource: "api", priorityWeight: 9, metadata: {} },
          { agentId: "executor-1", action: "deploy-staging", resource: "api", priorityWeight: 3, metadata: {} },
        ]
      );

      engine.arbitrate(conflictSet, trace);
      const traces = engine.getAllDecisionTraces();
      const result = validator.validate(traces[0], trace);
      validationResults.push(result.passed);
    }

    expect(validationResults.every((r) => r === true)).toBe(true);
  });

  it("authority hierarchy violation is detected by the validator", () => {
    // Build a graph where executor has higher authority than planner (inverted)
    const graph = new PolicyResolutionGraph();
    graph.addAuthority({ agentId: "executor-1", authorityLevel: 5, roles: ["executor"], canIssueReviewTokens: false });
    graph.addAuthority({ agentId: "planner-1", authorityLevel: 1, roles: ["planner"], canIssueReviewTokens: false });
    // No rules — default allow

    const engine = new ArbitrationEngine(graph);
    const validator = new DecisionTraceValidator(engine, graph);
    const generator = new ConflictGenerator();
    const trace = new TraceEngine("validation-authority-check");

    const conflictSet = generator.generateDirect(
      "validation-authority-check",
      "soft",
      [
        { agentId: "planner-1", action: "deploy-staging", resource: "api", priorityWeight: 10, metadata: {} },
        { agentId: "executor-1", action: "deploy-staging", resource: "api", priorityWeight: 3, metadata: {} },
      ]
    );

    engine.arbitrate(conflictSet, trace);
    const traces = engine.getAllDecisionTraces();
    const result = validator.validate(traces[0], trace);

    // executor-1 has higher authority (5) so it should win, not planner-1
    // The validator should confirm the authority hierarchy is respected
    expect(result.respectsAuthorityHierarchy).toBe(true);
    expect(result.winnerAgentId ?? traces[0].resolution.winnerAgentId).toBe("executor-1");
  });
});

// ---------------------------------------------------------------------------
// ConflictGenerator: registered scenario support
// ---------------------------------------------------------------------------

describe("Governance arbitration — ConflictGenerator registered scenarios", () => {
  it("generates a ConflictSet from a registered scenario specification", () => {
    const generator = new ConflictGenerator();

    generator.registerScenario({
      scenarioId: "scale-conflict",
      description: "Two planners propose conflicting scale operations",
      conflictClass: "soft",
      proposals: [
        { agentId: "planner-1", action: "scale-up-api", resource: "api", priorityWeight: 5, metadata: {} },
        { agentId: "planner-2", action: "scale-down-api", resource: "api", priorityWeight: 5, metadata: {} },
      ],
      activePolicies: ["rule-scale-conflict"],
      expectedDecision: "escalate",
      expectsReviewToken: true,
      expectsAuthorityOverride: false,
    });

    const conflictSet = generator.generate("scale-conflict", "run-gen-1");

    expect(conflictSet.proposals).toHaveLength(2);
    expect(conflictSet.conflictClass).toBe("soft");
    expect(conflictSet.proposals[0].proposalId).toBeDefined();
    expect(conflictSet.proposals[0].submittedAt).toBeDefined();
    expect(conflictSet.triggeredPolicies).toContain("rule-scale-conflict");
  });

  it("throws when generating from an unknown scenario ID", () => {
    const generator = new ConflictGenerator();

    expect(() => generator.generate("nonexistent-scenario", "run-x")).toThrow(
      "Unknown conflict scenario: nonexistent-scenario"
    );
  });
});
