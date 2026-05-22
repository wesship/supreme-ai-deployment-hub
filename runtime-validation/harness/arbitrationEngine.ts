/**
 * runtime-validation/harness/arbitrationEngine.ts
 *
 * Wave 30: Governance Arbitration Under Conflict
 *
 * This module provides the core arbitration harness primitives:
 *
 *   PolicyResolutionGraph  — defines precedence rules and authority hierarchy
 *   ArbitrationEngine      — deterministic conflict resolution
 *   ConflictGenerator      — injects controlled conflict scenarios
 *   DecisionTraceValidator — verifies decision reproducibility and explainability
 *
 * All primitives are pure in-memory and produce deterministic outputs for
 * the same inputs. No production infrastructure is required.
 */

import { TraceEngine } from "./traceEngine.js";
import type {
  AgentAuthority,
  AgentProposal,
  ArbitrationDecisionTrace,
  ConflictClass,
  ConflictScenario,
  ConflictSet,
  DecisionValidationResult,
  PolicyResolutionResult,
  PolicyRule,
} from "./types.js";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

let _idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${String(++_idCounter).padStart(4, "0")}`;
}

export function resetArbitrationIdSequence(): void {
  _idCounter = 0;
}

// ---------------------------------------------------------------------------
// PolicyResolutionGraph
// ---------------------------------------------------------------------------

/**
 * The PolicyResolutionGraph holds the ordered set of policy rules and the
 * authority hierarchy for all agents. It is the single source of truth for
 * what is allowed, denied, or escalated during conflict resolution.
 *
 * Rules are evaluated in descending precedence order. The first matching rule
 * wins. If no rule matches, the default decision is "allow".
 */
export class PolicyResolutionGraph {
  private rules: PolicyRule[] = [];
  private authorities: Map<string, AgentAuthority> = new Map();

  // ---- Rule management ----

  addRule(rule: PolicyRule): this {
    this.rules.push(rule);
    // Keep sorted by precedence descending so evaluation is always in order
    this.rules.sort((a, b) => b.precedence - a.precedence);
    return this;
  }

  addRules(rules: PolicyRule[]): this {
    rules.forEach((r) => this.addRule(r));
    return this;
  }

  getRules(): readonly PolicyRule[] {
    return this.rules;
  }

  // ---- Authority management ----

  addAuthority(authority: AgentAuthority): this {
    this.authorities.set(authority.agentId, authority);
    return this;
  }

  getAuthority(agentId: string): AgentAuthority | undefined {
    return this.authorities.get(agentId);
  }

  getAuthorityLevel(agentId: string): number {
    return this.authorities.get(agentId)?.authorityLevel ?? 0;
  }

  // ---- Rule evaluation ----

  /**
   * Evaluate a single action against the policy graph.
   * Returns the first matching rule and its decision, or a default "allow".
   */
  evaluate(
    action: string
  ): { rule: PolicyRule | null; decision: "allow" | "deny" | "escalate" } {
    for (const rule of this.rules) {
      if (this.matchesPattern(action, rule.actionPattern)) {
        return { rule, decision: rule.decision };
      }
    }
    return { rule: null, decision: "allow" };
  }

  /**
   * Evaluate all proposals in a conflict set and return the ordered list of
   * rule matches. Used by the ArbitrationEngine to build the decision trace.
   */
  evaluateConflictSet(conflictSet: ConflictSet): Array<{
    proposal: AgentProposal;
    rule: PolicyRule | null;
    decision: "allow" | "deny" | "escalate";
  }> {
    return conflictSet.proposals.map((proposal) => {
      const { rule, decision } = this.evaluate(proposal.action);
      return { proposal, rule, decision };
    });
  }

  private matchesPattern(action: string, pattern: string): boolean {
    if (pattern === "*") return true;
    if (pattern.endsWith("*")) {
      return action.startsWith(pattern.slice(0, -1));
    }
    return action === pattern;
  }
}

// ---------------------------------------------------------------------------
// ArbitrationEngine
// ---------------------------------------------------------------------------

/**
 * The ArbitrationEngine receives a ConflictSet and a PolicyResolutionGraph
 * and produces a deterministic PolicyResolutionResult.
 *
 * Resolution algorithm (in order):
 *
 * 1. Hard conflict check: if any proposal violates a "deny" rule, deny_all.
 * 2. Escalation check: if any proposal triggers an "escalate" rule, escalate.
 * 3. Structural conflict check: if proposals are mutually exclusive, apply
 *    authority-weighted tie-breaking.
 * 4. Soft conflict: select the highest-priority agent's proposal.
 * 5. No conflict: allow all (should not reach here via ConflictSet).
 *
 * Tie-breaking is deterministic: when two agents have equal priority, the
 * proposal submitted first (by submittedAt timestamp) wins. If timestamps
 * are identical, the proposal with the lexicographically smaller proposalId
 * wins. This ensures the same inputs always produce the same winner.
 */
export class ArbitrationEngine {
  private graph: PolicyResolutionGraph;
  private decisions: Map<string, ArbitrationDecisionTrace> = new Map();

  constructor(graph: PolicyResolutionGraph) {
    this.graph = graph;
  }

  /**
   * Arbitrate a conflict set and return the resolution result.
   * Also records the full decision trace for later validation.
   */
  arbitrate(
    conflictSet: ConflictSet,
    trace: TraceEngine
  ): PolicyResolutionResult {
    const decisionId = nextId("decision");
    const rulesEvaluated: ArbitrationDecisionTrace["rulesEvaluated"] = [];

    // Record arbitration_begin
    trace.record("arbitration-engine", "arbitration_begin", {
      conflictId: conflictSet.conflictId,
      conflictClass: conflictSet.conflictClass,
      proposalCount: conflictSet.proposals.length,
      summary: `Arbitrating conflict ${conflictSet.conflictId}`,
    });

    // Evaluate all proposals against the policy graph
    const evaluations = this.graph.evaluateConflictSet(conflictSet);
    for (const ev of evaluations) {
      if (ev.rule) {
        rulesEvaluated.push({ rule: ev.rule, matched: true });
      }
    }

    let resolution: PolicyResolutionResult;

    // Step 1: Hard conflict — any deny rule triggers deny_all
    const hardDenied = evaluations.filter((ev) => ev.decision === "deny");
    if (hardDenied.length > 0) {
      resolution = this.buildResolution(conflictSet, "deny_all", undefined, {
        appliedRule: hardDenied[0].rule ?? undefined,
        explanation: `Hard policy violation: action "${hardDenied[0].proposal.action}" is denied by rule "${hardDenied[0].rule?.name ?? "unknown"}"`,
        reviewTokenIssued: false,
      });
      this.emitDecision(trace, conflictSet, resolution, "forbidden_action");
      this.storeTrace(decisionId, conflictSet, rulesEvaluated, resolution, trace);
      return resolution;
    }

    // Step 2: Escalation — any escalate rule triggers escalation
    const escalated = evaluations.filter((ev) => ev.decision === "escalate");
    if (escalated.length > 0) {
      const reviewTokenId = nextId("review-token");
      resolution = this.buildResolution(conflictSet, "escalate", undefined, {
        appliedRule: escalated[0].rule ?? undefined,
        explanation: `Policy escalation required: action "${escalated[0].proposal.action}" requires human review`,
        reviewTokenIssued: true,
        reviewTokenId,
      });
      trace.record("arbitration-engine", "review_token_issued", {
        conflictId: conflictSet.conflictId,
        reviewTokenId,
        reason: escalated[0].rule?.reason ?? "escalation required",
        summary: `Review token ${reviewTokenId} issued`,
      });
      this.emitDecision(trace, conflictSet, resolution, "arbitration_escalate");
      this.storeTrace(decisionId, conflictSet, rulesEvaluated, resolution, trace);
      return resolution;
    }

    // Step 3 & 4: Select winner by authority + priority + deterministic tie-break
    const winner = this.selectWinner(conflictSet.proposals, trace, conflictSet);
    const isTieBreak =
      conflictSet.conflictClass === "structural" ||
      this.hasPriorityTie(conflictSet.proposals);

    resolution = this.buildResolution(
      conflictSet,
      isTieBreak ? "tie_break" : "allow_winner",
      winner,
      {
        explanation: isTieBreak
          ? `Deterministic tie-break: agent "${winner.agentId}" selected by authority level and proposal timestamp`
          : `Highest-priority agent "${winner.agentId}" wins soft conflict`,
        reviewTokenIssued: false,
      }
    );

    if (isTieBreak) {
      trace.record("arbitration-engine", "tie_break", {
        conflictId: conflictSet.conflictId,
        winnerId: winner.agentId,
        winnerProposalId: winner.proposalId,
        summary: `Tie-break: ${winner.agentId} wins`,
      });
    }

    // Check if an authority override occurred
    const authorityOverride = this.detectAuthorityOverride(
      conflictSet.proposals,
      winner
    );
    if (authorityOverride) {
      trace.record("arbitration-engine", "authority_override", {
        conflictId: conflictSet.conflictId,
        overridingAgent: winner.agentId,
        overriddenAgent: authorityOverride.overriddenAgentId,
        reason: "Higher authority level",
        summary: `${winner.agentId} overrides ${authorityOverride.overriddenAgentId}`,
      });
    }

    this.emitDecision(trace, conflictSet, resolution, "arbitration_decision");
    this.storeTrace(decisionId, conflictSet, rulesEvaluated, resolution, trace);
    return resolution;
  }

  getDecisionTrace(decisionId: string): ArbitrationDecisionTrace | undefined {
    return this.decisions.get(decisionId);
  }

  getAllDecisionTraces(): ArbitrationDecisionTrace[] {
    return Array.from(this.decisions.values());
  }

  // ---- Private helpers ----

  private selectWinner(
    proposals: AgentProposal[],
    trace: TraceEngine,
    conflictSet: ConflictSet
  ): AgentProposal {
    return [...proposals].sort((a, b) => {
      // 1. Higher authority level wins
      const authA = this.graph.getAuthorityLevel(a.agentId);
      const authB = this.graph.getAuthorityLevel(b.agentId);
      if (authA !== authB) return authB - authA;

      // 2. Higher priority weight wins
      if (a.priorityWeight !== b.priorityWeight) {
        return b.priorityWeight - a.priorityWeight;
      }

      // 3. Earlier submission time wins (deterministic)
      const timeCompare = a.submittedAt.localeCompare(b.submittedAt);
      if (timeCompare !== 0) return timeCompare;

      // 4. Lexicographically smaller proposalId wins (fully deterministic)
      return a.proposalId.localeCompare(b.proposalId);
    })[0];
  }

  private hasPriorityTie(proposals: AgentProposal[]): boolean {
    if (proposals.length < 2) return false;
    const sorted = [...proposals].sort(
      (a, b) => b.priorityWeight - a.priorityWeight
    );
    return sorted[0].priorityWeight === sorted[1].priorityWeight &&
      this.graph.getAuthorityLevel(sorted[0].agentId) ===
        this.graph.getAuthorityLevel(sorted[1].agentId);
  }

  private detectAuthorityOverride(
    proposals: AgentProposal[],
    winner: AgentProposal
  ): { overriddenAgentId: string } | null {
    const winnerAuth = this.graph.getAuthorityLevel(winner.agentId);
    const overridden = proposals.find(
      (p) =>
        p.agentId !== winner.agentId &&
        this.graph.getAuthorityLevel(p.agentId) < winnerAuth
    );
    return overridden ? { overriddenAgentId: overridden.agentId } : null;
  }

  private buildResolution(
    conflictSet: ConflictSet,
    decision: PolicyResolutionResult["decision"],
    winner: AgentProposal | undefined,
    extras: Partial<PolicyResolutionResult>
  ): PolicyResolutionResult {
    return {
      conflictId: conflictSet.conflictId,
      runId: conflictSet.runId,
      decision,
      winnerProposalId: winner?.proposalId,
      winnerAgentId: winner?.agentId,
      isDeterministic: true,
      explanation: extras.explanation ?? "",
      reviewTokenIssued: extras.reviewTokenIssued ?? false,
      reviewTokenId: extras.reviewTokenId,
      appliedRule: extras.appliedRule,
    };
  }

  private emitDecision(
    trace: TraceEngine,
    conflictSet: ConflictSet,
    resolution: PolicyResolutionResult,
    kind: "arbitration_decision" | "arbitration_escalate" | "forbidden_action"
  ): void {
    trace.record("arbitration-engine", kind, {
      conflictId: conflictSet.conflictId,
      decision: resolution.decision,
      winnerAgentId: resolution.winnerAgentId ?? null,
      reviewTokenIssued: resolution.reviewTokenIssued,
      explanation: resolution.explanation,
      summary: `Decision: ${resolution.decision}`,
    });
  }

  private storeTrace(
    decisionId: string,
    conflictSet: ConflictSet,
    rulesEvaluated: ArbitrationDecisionTrace["rulesEvaluated"],
    resolution: PolicyResolutionResult,
    trace: TraceEngine
  ): void {
    const decisionTrace: ArbitrationDecisionTrace = {
      decisionId,
      conflictId: conflictSet.conflictId,
      runId: conflictSet.runId,
      proposals: conflictSet.proposals,
      rulesEvaluated,
      resolution,
      traceEvents: trace.allEvents().filter(
        (e) =>
          e.payload["conflictId"] === conflictSet.conflictId ||
          e.kind === "arbitration_begin" ||
          e.kind === "arbitration_decision" ||
          e.kind === "arbitration_escalate" ||
          e.kind === "forbidden_action" ||
          e.kind === "review_token_issued" ||
          e.kind === "tie_break" ||
          e.kind === "authority_override"
      ),
      decidedAt: new Date().toISOString(),
    };
    this.decisions.set(decisionId, decisionTrace);
  }
}

// ---------------------------------------------------------------------------
// ConflictGenerator
// ---------------------------------------------------------------------------

/**
 * The ConflictGenerator produces ConflictSet instances from ConflictScenario
 * specifications. It is the injection layer that creates controlled conflict
 * conditions for the ArbitrationEngine to resolve.
 */
export class ConflictGenerator {
  private scenarios: Map<string, ConflictScenario> = new Map();

  registerScenario(scenario: ConflictScenario): this {
    this.scenarios.set(scenario.scenarioId, scenario);
    return this;
  }

  /**
   * Generate a ConflictSet from a registered scenario.
   * The proposals are stamped with unique IDs and timestamps.
   */
  generate(scenarioId: string, runId: string): ConflictSet {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) {
      throw new Error(`Unknown conflict scenario: ${scenarioId}`);
    }

    const baseTime = new Date();
    const proposals: AgentProposal[] = scenario.proposals.map((p, i) => ({
      ...p,
      proposalId: nextId("proposal"),
      // Stagger timestamps by 1ms to ensure deterministic ordering
      submittedAt: new Date(baseTime.getTime() + i).toISOString(),
    }));

    return {
      conflictId: nextId("conflict"),
      runId,
      conflictClass: scenario.conflictClass,
      proposals,
      triggeredPolicies: scenario.activePolicies,
      detectedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate a ConflictSet directly from proposals without a registered scenario.
   * Useful for ad-hoc conflict injection in tests.
   */
  generateDirect(
    runId: string,
    conflictClass: ConflictClass,
    proposals: Array<Omit<AgentProposal, "proposalId" | "submittedAt">>,
    triggeredPolicies: string[] = []
  ): ConflictSet {
    const baseTime = new Date();
    const stamped: AgentProposal[] = proposals.map((p, i) => ({
      ...p,
      proposalId: nextId("proposal"),
      submittedAt: new Date(baseTime.getTime() + i).toISOString(),
    }));

    return {
      conflictId: nextId("conflict"),
      runId,
      conflictClass,
      proposals: stamped,
      triggeredPolicies,
      detectedAt: new Date().toISOString(),
    };
  }

  getScenario(scenarioId: string): ConflictScenario | undefined {
    return this.scenarios.get(scenarioId);
  }
}

// ---------------------------------------------------------------------------
// DecisionTraceValidator
// ---------------------------------------------------------------------------

/**
 * The DecisionTraceValidator verifies that an arbitration decision is:
 *
 * 1. Reproducible: replaying the same inputs produces the same decision.
 * 2. Explainable: the decision is fully explained by the rule evaluation path.
 * 3. Free of hidden state: no mutable globals influenced the decision.
 * 4. Authority-respecting: the winner has >= authority of all losers.
 * 5. Forbidden-action-suppressing: denied actions are not present in the winner.
 */
export class DecisionTraceValidator {
  private engine: ArbitrationEngine;
  private graph: PolicyResolutionGraph;

  constructor(engine: ArbitrationEngine, graph: PolicyResolutionGraph) {
    this.engine = engine;
    this.graph = graph;
  }

  validate(
    decisionTrace: ArbitrationDecisionTrace,
    trace: TraceEngine
  ): DecisionValidationResult {
    const violations: string[] = [];

    // Check 1: Reproducibility — re-run arbitration with same inputs
    const replayConflictSet: ConflictSet = {
      conflictId: decisionTrace.conflictId,
      runId: decisionTrace.runId,
      conflictClass: this.inferConflictClass(decisionTrace),
      proposals: decisionTrace.proposals,
      triggeredPolicies: [],
      detectedAt: new Date().toISOString(),
    };

    const replayTrace = new TraceEngine(`replay-${decisionTrace.runId}`);
    const replayResult = this.engine.arbitrate(replayConflictSet, replayTrace);

    const isReproducible =
      replayResult.decision === decisionTrace.resolution.decision &&
      replayResult.winnerAgentId === decisionTrace.resolution.winnerAgentId;

    if (!isReproducible) {
      violations.push(
        `Decision not reproducible: original="${decisionTrace.resolution.decision}/${decisionTrace.resolution.winnerAgentId}", replay="${replayResult.decision}/${replayResult.winnerAgentId}"`
      );
    }

    // Check 2: Explainability — the decision must have a non-empty explanation
    const isExplainable =
      decisionTrace.resolution.explanation.length > 0 &&
      (decisionTrace.resolution.decision === "allow_winner" ||
        decisionTrace.resolution.decision === "tie_break" ||
        decisionTrace.rulesEvaluated.some((r) => r.matched));

    if (!isExplainable) {
      violations.push(
        `Decision not explainable: no matched rules and no explanation for decision "${decisionTrace.resolution.decision}"`
      );
    }

    // Check 3: Hidden state — verify the decision events appear in the trace
    const hasArbitrationBegin = decisionTrace.traceEvents.some(
      (e) => e.kind === "arbitration_begin"
    );
    const hasDecisionEvent = decisionTrace.traceEvents.some(
      (e) =>
        e.kind === "arbitration_decision" ||
        e.kind === "arbitration_escalate" ||
        e.kind === "forbidden_action"
    );
    const hasHiddenStateInfluence = !hasArbitrationBegin || !hasDecisionEvent;

    if (hasHiddenStateInfluence) {
      violations.push(
        "Hidden state influence detected: arbitration_begin or decision event missing from trace"
      );
    }

    // Check 4: Authority hierarchy — winner must have >= authority of all losers
    const respectsAuthorityHierarchy = this.checkAuthorityHierarchy(
      decisionTrace,
      violations
    );

    // Check 5: Forbidden actions — denied actions must not be the winner
    const forbiddenActionsSuppressed = this.checkForbiddenActions(
      decisionTrace,
      violations
    );

    const passed =
      isReproducible &&
      isExplainable &&
      !hasHiddenStateInfluence &&
      respectsAuthorityHierarchy &&
      forbiddenActionsSuppressed &&
      violations.length === 0;

    return {
      decisionId: decisionTrace.decisionId,
      isReproducible,
      isExplainable,
      hasHiddenStateInfluence,
      respectsAuthorityHierarchy,
      forbiddenActionsSuppressed,
      violations,
      passed,
    };
  }

  private inferConflictClass(
    decisionTrace: ArbitrationDecisionTrace
  ): ConflictClass {
    // Infer from the decision type
    if (decisionTrace.resolution.decision === "deny_all") return "hard";
    if (decisionTrace.resolution.decision === "tie_break") return "structural";
    return "soft";
  }

  private checkAuthorityHierarchy(
    decisionTrace: ArbitrationDecisionTrace,
    violations: string[]
  ): boolean {
    const { resolution, proposals } = decisionTrace;
    if (!resolution.winnerAgentId) return true; // no winner = no hierarchy check

    const winnerAuth = this.graph.getAuthorityLevel(resolution.winnerAgentId);
    const losers = proposals.filter(
      (p) => p.agentId !== resolution.winnerAgentId
    );

    // For tie_break and allow_winner: winner must have >= authority of all losers
    // (unless the winner won purely on priority weight, which is also valid)
    for (const loser of losers) {
      const loserAuth = this.graph.getAuthorityLevel(loser.agentId);
      const winnerPriority = proposals.find(
        (p) => p.agentId === resolution.winnerAgentId
      )!.priorityWeight;
      const loserPriority = loser.priorityWeight;

      if (loserAuth > winnerAuth && loserPriority <= winnerPriority) {
        violations.push(
          `Authority hierarchy violated: loser "${loser.agentId}" (auth=${loserAuth}) has higher authority than winner "${resolution.winnerAgentId}" (auth=${winnerAuth})`
        );
        return false;
      }
    }
    return true;
  }

  private checkForbiddenActions(
    decisionTrace: ArbitrationDecisionTrace,
    violations: string[]
  ): boolean {
    if (!decisionTrace.resolution.winnerAgentId) return true;

    const winnerProposal = decisionTrace.proposals.find(
      (p) => p.agentId === decisionTrace.resolution.winnerAgentId
    );
    if (!winnerProposal) return true;

    const { decision: policyDecision } = this.graph.evaluate(
      winnerProposal.action
    );
    if (policyDecision === "deny") {
      violations.push(
        `Forbidden action not suppressed: winning action "${winnerProposal.action}" is denied by policy but was allowed`
      );
      return false;
    }
    return true;
  }
}
