/**
 * runtime-validation/harness/types.ts
 *
 * Shared types for the D3VONN.IO Runtime Validation Harness.
 * Waves 27-31: execution traces, memory continuity, failure recovery,
 * governance arbitration, and observability intelligence.
 * Intentionally decoupled from production src/ types.
 */

// ---------------------------------------------------------------------------
// Trace & DAG types
// ---------------------------------------------------------------------------

export type TraceEventKind =
  | "agent_start"
  | "agent_stop"
  | "delegation"
  | "tool_call"
  | "tool_result"
  | "thought"
  | "observation"
  | "memory_read"
  | "memory_write"
  | "memory_snapshot"
  | "memory_restore"
  | "memory_drift"
  | "restart_begin"
  | "restart_complete"
  | "governance_check"
  | "governance_block"
  | "governance_escalate"
  | "replay_start"
  | "replay_end"
  | "failure_injected"
  | "failure_detected"
  | "recovery_begin"
  | "recovery_complete"
  | "recovery_failed"
  | "checkpoint_saved"
  | "checkpoint_loaded"
  | "replay_step"
  | "idempotency_check"
  | "idempotency_violation"
  | "network_partition"
  | "network_restored"
  | "causal_link"
  | "conflict_detected"
  | "arbitration_begin"
  | "arbitration_decision"
  | "arbitration_escalate"
  | "policy_precedence"
  | "forbidden_action"
  | "review_token_issued"
  | "review_token_resolved"
  | "authority_override"
  | "tie_break"
  // Wave 31: observability intelligence events
  | "obs_graph_ingested"      // event batch ingested into the observability graph
  | "obs_correlation_found"   // cross-wave causal correlation identified
  | "obs_anomaly_detected"    // anomaly detected in execution pattern
  | "obs_drift_forecast"      // drift forecast computed
  | "obs_health_scored"       // system health score computed
  | "obs_policy_heatmap"      // governance policy activation heatmap updated
  | "obs_pre_failure_signal"  // pre-failure signal detected
  | "error";

export interface TraceEvent {
  id: string;
  runId: string;
  spanId: string;
  parentSpanId?: string;
  agentId: string;
  kind: TraceEventKind;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface DAGNode {
  id: string;
  kind: TraceEventKind;
  agentId: string;
  label: string;
  children: DAGNode[];
}

export interface ExecutionDAG {
  runId: string;
  root: DAGNode;
  events: TraceEvent[];
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Scenario result types
// ---------------------------------------------------------------------------

export type ScenarioStatus = "passed" | "failed" | "skipped";

export interface ScenarioAssertion {
  description: string;
  passed: boolean;
  detail?: string;
}

export interface ScenarioResult {
  scenarioId: string;
  status: ScenarioStatus;
  dag: ExecutionDAG;
  assertions: ScenarioAssertion[];
  error?: string;
  completedAt: string;
}

// ---------------------------------------------------------------------------
// Wave 28: Memory snapshot & replay types
// ---------------------------------------------------------------------------

export interface MemorySnapshot {
  snapshotId: string;
  runId: string;
  spanId: string;
  capturedAt: string;
  agentId: string;
  memoryEntries: Record<string, MemorySnapshotEntry>;
  governanceState: GovernanceSnapshot;
  stepIndex: number;
}

export interface MemorySnapshotEntry {
  key: string;
  content: string;
  embedding?: number[];
  writtenAt: string;
  expiresAt?: string;
}

export interface GovernanceSnapshot {
  activePolicies: string[];
  grantedCapabilities: string[];
  pendingEscalations: string[];
}

export interface ReplayComparison {
  snapshotId: string;
  runId: string;
  agentId: string;
  memoryFullyRecovered: boolean;
  governanceStatePreserved: boolean;
  missingKeys: string[];
  unexpectedKeys: string[];
  divergedKeys: DriftRecord[];
  driftScore: number;
}

export interface DriftRecord {
  key: string;
  expected: string;
  actual: string;
  embeddingSimilarity?: number;
}

// ---------------------------------------------------------------------------
// Wave 29: Failure simulation types
// ---------------------------------------------------------------------------

export type FailureMode =
  | "process_crash"
  | "network_partition"
  | "memory_corruption"
  | "tool_timeout"
  | "governance_deadlock"
  | "partial_write"
  | "replay_corruption";

export interface FailureSpec {
  failureId: string;
  mode: FailureMode;
  targetAgent: string;
  injectAtStep: number;
  description: string;
  expectedRecoverable: boolean;
}

export interface FailureInjectionResult {
  failureId: string;
  mode: FailureMode;
  injectedAt: string;
  detectedAt?: string;
  recovered: boolean;
  recoverySteps: string[];
  failureWindow: TraceEvent[];
}

export interface ExecutionCheckpoint {
  checkpointId: string;
  runId: string;
  spanId: string;
  stepIndex: number;
  capturedAt: string;
  agentId: string;
  traceHistory: TraceEvent[];
  memoryState: Record<string, string>;
  governanceState: GovernanceSnapshot;
  preFailure: boolean;
}

export interface ReplayStepResult {
  stepIndex: number;
  eventKind: TraceEventKind;
  agentId: string;
  originalOutput: Record<string, unknown>;
  replayOutput: Record<string, unknown>;
  isIdempotent: boolean;
  divergedFields: string[];
}

export interface ReplayIntegrityReport {
  checkpointId: string;
  runId: string;
  totalStepsReplayed: number;
  idempotentSteps: number;
  nonIdempotentSteps: number;
  violations: ReplayStepResult[];
  passed: boolean;
}

export interface CausalLink {
  causeEventId: string;
  effectEventId: string;
  reason: string;
}

export interface CausalGraph {
  runId: string;
  nodes: Map<string, TraceEvent>;
  links: CausalLink[];
  roots: string[];
}

export interface CausalIntegrityResult {
  runId: string;
  allEventsHaveCause: boolean;
  isAcyclic: boolean;
  orphanedEvents: string[];
  cyclicEvents: string[];
  passed: boolean;
}

// ---------------------------------------------------------------------------
// Wave 30: Conflict taxonomy types
// ---------------------------------------------------------------------------

export type ConflictClass = "soft" | "hard" | "structural";

export interface AgentProposal {
  proposalId: string;
  agentId: string;
  action: string;
  resource: string;
  submittedAt: string;
  priorityWeight: number;
  metadata: Record<string, unknown>;
}

export interface ConflictSet {
  conflictId: string;
  runId: string;
  conflictClass: ConflictClass;
  proposals: AgentProposal[];
  triggeredPolicies: string[];
  detectedAt: string;
}

export interface PolicyRule {
  ruleId: string;
  name: string;
  precedence: number;
  actionPattern: string;
  decision: "allow" | "deny" | "escalate";
  overridable: boolean;
  overrideRequiresAuthority?: number;
  reason: string;
}

export interface AgentAuthority {
  agentId: string;
  authorityLevel: number;
  roles: string[];
  canIssueReviewTokens: boolean;
}

export interface PolicyResolutionResult {
  conflictId: string;
  runId: string;
  appliedRule?: PolicyRule;
  decision: "allow_winner" | "deny_all" | "escalate" | "tie_break";
  winnerProposalId?: string;
  winnerAgentId?: string;
  reviewTokenIssued: boolean;
  reviewTokenId?: string;
  explanation: string;
  isDeterministic: boolean;
}

export interface ArbitrationDecisionTrace {
  decisionId: string;
  conflictId: string;
  runId: string;
  proposals: AgentProposal[];
  rulesEvaluated: Array<{ rule: PolicyRule; matched: boolean }>;
  resolution: PolicyResolutionResult;
  traceEvents: TraceEvent[];
  decidedAt: string;
}

export interface DecisionValidationResult {
  decisionId: string;
  isReproducible: boolean;
  isExplainable: boolean;
  hasHiddenStateInfluence: boolean;
  respectsAuthorityHierarchy: boolean;
  forbiddenActionsSuppressed: boolean;
  violations: string[];
  passed: boolean;
}

export interface ConflictScenario {
  scenarioId: string;
  description: string;
  conflictClass: ConflictClass;
  proposals: Array<Omit<AgentProposal, "proposalId" | "submittedAt">>;
  activePolicies: string[];
  expectedDecision: PolicyResolutionResult["decision"];
  expectsReviewToken: boolean;
  expectsAuthorityOverride: boolean;
}

// ---------------------------------------------------------------------------
// Wave 31: Observability intelligence types
// ---------------------------------------------------------------------------

/**
 * The wave source of a trace event — used by the ObservabilityGraph to
 * partition events by their originating harness wave for cross-wave correlation.
 */
export type WaveSource = "wave-27" | "wave-28" | "wave-29" | "wave-30" | "wave-31" | "unknown";

/**
 * An enriched event node in the ObservabilityGraph.
 * Wraps a TraceEvent with wave attribution, ingestion metadata, and
 * pre-computed behavioral signals.
 */
export interface ObsGraphNode {
  /** The original trace event */
  event: TraceEvent;
  /** Which harness wave produced this event */
  waveSource: WaveSource;
  /** ISO-8601 timestamp when this node was ingested into the graph */
  ingestedAt: string;
  /** Behavioral signal tags derived from the event kind and payload */
  signals: ObsSignal[];
}

/**
 * A behavioral signal derived from a trace event.
 * Signals are the atomic unit of observability intelligence.
 */
export type ObsSignalKind =
  | "governance_trigger"    // an arbitration or governance event occurred
  | "failure_event"         // a failure was injected or detected
  | "recovery_event"        // a recovery procedure was initiated or completed
  | "memory_event"          // a memory read/write/snapshot/restore occurred
  | "authority_event"       // an authority override or tie-break occurred
  | "escalation_event"      // a review token was issued
  | "anomaly_candidate"     // event pattern suggests potential anomaly
  | "pre_failure_signal";   // event pattern suggests impending failure

export interface ObsSignal {
  kind: ObsSignalKind;
  confidence: number;  // 0.0 to 1.0
  detail: string;
}

/**
 * A cross-wave causal correlation: a link between events from different
 * harness waves that share a causal relationship.
 */
export interface CrossWaveCorrelation {
  correlationId: string;
  /** The earlier event (cause) */
  sourceEvent: ObsGraphNode;
  /** The later event (effect) */
  targetEvent: ObsGraphNode;
  /** The waves involved */
  sourceWave: WaveSource;
  targetWave: WaveSource;
  /** The causal relationship type */
  correlationType:
    | "governance_to_recovery"    // a governance block caused a recovery
    | "failure_to_arbitration"    // a failure triggered an arbitration
    | "memory_drift_to_conflict"  // memory drift preceded a conflict
    | "escalation_to_failure"     // an escalation preceded a failure
    | "recovery_to_governance"    // a recovery triggered a governance check
    | "pattern_repeat";           // the same event pattern repeated across waves
  confidence: number;
  detectedAt: string;
}

/**
 * Governance telemetry aggregated over a time window.
 */
export interface GovernanceTelemetry {
  windowStart: string;
  windowEnd: string;
  /** Total number of arbitration events in the window */
  totalArbitrations: number;
  /** Breakdown by decision type */
  decisionBreakdown: Record<PolicyResolutionResult["decision"], number>;
  /** Policy activation frequency: ruleId -> count */
  policyActivationFrequency: Record<string, number>;
  /** Number of override attempts (authority_override events) */
  overrideAttempts: number;
  /** Number of review tokens issued */
  reviewTokensIssued: number;
  /** Number of forbidden actions suppressed */
  forbiddenActionsSuppressed: number;
  /** The most frequently triggered policy rule ID */
  dominantPolicy?: string;
  /** Conflict frequency: conflictClass -> count */
  conflictFrequency: Record<ConflictClass, number>;
}

/**
 * A temporal event cluster: a group of events that occurred within a
 * short time window and are likely causally related.
 */
export interface TemporalCluster {
  clusterId: string;
  /** Events in this cluster, sorted by timestamp */
  events: ObsGraphNode[];
  /** The time window of this cluster in milliseconds */
  windowMs: number;
  /** Whether this cluster contains a cross-wave correlation */
  hasCrossWaveCorrelation: boolean;
  /** The dominant signal kind in this cluster */
  dominantSignal?: ObsSignalKind;
}

/**
 * An anomaly detected in the execution pattern.
 */
export interface ObsAnomaly {
  anomalyId: string;
  detectedAt: string;
  /** The events that triggered anomaly detection */
  triggeringEvents: ObsGraphNode[];
  /** The anomaly type */
  anomalyType:
    | "governance_spike"          // unusual spike in governance events
    | "failure_cluster"           // multiple failures in a short window
    | "authority_escalation_loop" // repeated escalations without resolution
    | "memory_drift_acceleration" // drift rate increasing over time
    | "recovery_failure_rate";    // recovery procedures failing repeatedly
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  /** Whether this anomaly is a pre-failure signal */
  isPreFailureSignal: boolean;
}

/**
 * A system health score computed over a time window.
 * Score ranges from 0.0 (completely unhealthy) to 1.0 (fully healthy).
 */
export interface SystemHealthScore {
  computedAt: string;
  windowMs: number;
  /** Overall health score */
  score: number;
  /** Component scores */
  components: {
    executionHealth: number;    // based on failure rate and recovery success
    memoryHealth: number;       // based on drift rate and recovery completeness
    governanceHealth: number;   // based on conflict rate and escalation frequency
    recoveryHealth: number;     // based on recovery success rate
    authorityHealth: number;    // based on override attempts and hierarchy violations
  };
  /** Active anomalies that contributed to score reduction */
  activeAnomalies: ObsAnomaly[];
  /** Trend: is health improving, stable, or degrading? */
  trend: "improving" | "stable" | "degrading";
  /** Forecast: predicted health score in the next window */
  forecastScore?: number;
}

/**
 * A drift forecast: predicted drift rate based on historical patterns.
 */
export interface DriftForecast {
  forecastId: string;
  computedAt: string;
  /** Historical drift observations used to compute the forecast */
  historicalDriftScores: number[];
  /** Predicted drift score for the next window */
  predictedDriftScore: number;
  /** Confidence in the prediction (0.0 to 1.0) */
  confidence: number;
  /** Whether the predicted drift exceeds the alert threshold */
  exceedsAlertThreshold: boolean;
  alertThreshold: number;
}
