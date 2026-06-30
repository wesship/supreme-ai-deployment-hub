/**
 * runtime-validation/harness/observabilityEngine.ts
 *
 * Wave 31: Observability Intelligence
 *
 * This module provides the four observability primitives:
 *
 *   ObservabilityGraph        — unified event graph across all harness waves
 *   GovernanceTelemetryEngine — arbitration event aggregation and policy heatmaps
 *   TemporalCorrelationSystem — cross-wave causal correlation and clustering
 *   SystemHealthModel         — anomaly detection, drift forecasting, health scoring
 *
 * All primitives are pure in-memory and produce deterministic outputs for
 * the same inputs. No production infrastructure is required.
 */

import type {
  ArbitrationDecisionTrace,
  ConflictClass,
  CrossWaveCorrelation,
  DriftForecast,
  GovernanceTelemetry,
  ObsAnomaly,
  ObsGraphNode,
  ObsSignal,
  ObsSignalKind,
  PolicyResolutionResult,
  SystemHealthScore,
  TemporalCluster,
  TraceEvent,
  WaveSource,
} from "./types.js";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

let _idCounter = 0;
export function resetObsIdSequence(): void {
  _idCounter = 0;
}
function nextId(prefix: string): string {
  return `${prefix}-${String(++_idCounter).padStart(4, "0")}`;
}

function isoNow(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Wave attribution
// ---------------------------------------------------------------------------

const WAVE_27_KINDS = new Set([
  "agent_start", "agent_stop", "delegation", "tool_call", "tool_result",
  "thought", "observation", "governance_check",
  "governance_escalate", "replay_start", "replay_end",
]);
const WAVE_28_KINDS = new Set([
  "memory_snapshot", "memory_restore", "memory_drift", "restart_begin", "restart_complete",
]);
const WAVE_29_KINDS = new Set([
  "failure_injected", "failure_detected", "recovery_begin", "recovery_complete",
  "recovery_failed", "checkpoint_saved", "checkpoint_loaded", "replay_step",
  "idempotency_check", "idempotency_violation", "network_partition", "network_restored", "causal_link",
]);
const WAVE_30_KINDS = new Set([
  "conflict_detected", "arbitration_begin", "arbitration_decision", "arbitration_escalate",
  "policy_precedence", "forbidden_action", "review_token_issued", "review_token_resolved",
  "authority_override", "tie_break", "governance_block",
]);
const WAVE_31_KINDS = new Set([
  "obs_graph_ingested", "obs_correlation_found", "obs_anomaly_detected",
  "obs_drift_forecast", "obs_health_scored", "obs_policy_heatmap", "obs_pre_failure_signal",
]);

function inferWave(event: TraceEvent): WaveSource {
  if (WAVE_31_KINDS.has(event.kind)) return "wave-31";
  if (WAVE_30_KINDS.has(event.kind)) return "wave-30";
  if (WAVE_29_KINDS.has(event.kind)) return "wave-29";
  if (WAVE_28_KINDS.has(event.kind)) return "wave-28";
  if (WAVE_27_KINDS.has(event.kind)) return "wave-27";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Signal derivation
// ---------------------------------------------------------------------------

function deriveSignals(event: TraceEvent): ObsSignal[] {
  const signals: ObsSignal[] = [];

  if (WAVE_30_KINDS.has(event.kind)) {
    signals.push({ kind: "governance_trigger", confidence: 1.0, detail: `${event.kind} event` });
  }
  if (event.kind === "authority_override") {
    signals.push({ kind: "authority_event", confidence: 1.0, detail: "Authority override recorded" });
  }
  if (event.kind === "review_token_issued") {
    signals.push({ kind: "escalation_event", confidence: 1.0, detail: "Review token issued" });
  }
  if (["failure_injected", "failure_detected", "recovery_failed"].includes(event.kind)) {
    signals.push({ kind: "failure_event", confidence: 1.0, detail: `${event.kind} event` });
  }
  if (["recovery_begin", "recovery_complete"].includes(event.kind)) {
    signals.push({ kind: "recovery_event", confidence: 1.0, detail: `${event.kind} event` });
  }
  if (["memory_read", "memory_write", "memory_snapshot", "memory_restore", "memory_drift"].includes(event.kind)) {
    signals.push({ kind: "memory_event", confidence: 1.0, detail: `${event.kind} event` });
  }
  if (event.kind === "memory_drift") {
    signals.push({ kind: "anomaly_candidate", confidence: 0.6, detail: "Memory drift detected — potential instability" });
  }
  if (event.kind === "recovery_failed") {
    signals.push({ kind: "pre_failure_signal", confidence: 0.7, detail: "Recovery failure — pre-failure signal" });
  }
  if (event.kind === "idempotency_violation") {
    signals.push({ kind: "anomaly_candidate", confidence: 0.8, detail: "Idempotency violation — non-deterministic replay" });
  }

  return signals;
}

// ---------------------------------------------------------------------------
// ObservabilityGraph
// ---------------------------------------------------------------------------

/**
 * The ObservabilityGraph ingests TraceEvents from all harness waves and
 * provides a unified, queryable view of the entire system's behavior history.
 *
 * Events are enriched with wave attribution and behavioral signals on ingestion.
 * The graph supports filtering by wave, signal kind, time range, and agent.
 */
export class ObservabilityGraph {
  private nodes: Map<string, ObsGraphNode> = new Map();
  private nodesByWave: Map<WaveSource, ObsGraphNode[]> = new Map();
  private nodesByRun: Map<string, ObsGraphNode[]> = new Map();

  /**
   * Ingest a single TraceEvent into the graph.
   */
  ingest(event: TraceEvent): ObsGraphNode {
    const waveSource = inferWave(event);
    const signals = deriveSignals(event);
    const node: ObsGraphNode = {
      event,
      waveSource,
      ingestedAt: isoNow(),
      signals,
    };

    this.nodes.set(event.id, node);

    const waveList = this.nodesByWave.get(waveSource) ?? [];
    waveList.push(node);
    this.nodesByWave.set(waveSource, waveList);

    const runList = this.nodesByRun.get(event.runId) ?? [];
    runList.push(node);
    this.nodesByRun.set(event.runId, runList);

    return node;
  }

  /**
   * Ingest all events from a trace array.
   */
  ingestAll(events: TraceEvent[]): ObsGraphNode[] {
    return events.map((e) => this.ingest(e));
  }

  /**
   * Ingest all events from an ArbitrationDecisionTrace.
   */
  ingestDecisionTrace(trace: ArbitrationDecisionTrace): ObsGraphNode[] {
    return this.ingestAll(trace.traceEvents);
  }

  // ---- Query API ----

  getNode(eventId: string): ObsGraphNode | undefined {
    return this.nodes.get(eventId);
  }

  getAllNodes(): ObsGraphNode[] {
    return Array.from(this.nodes.values());
  }

  getNodesByWave(wave: WaveSource): ObsGraphNode[] {
    return this.nodesByWave.get(wave) ?? [];
  }

  getNodesByRun(runId: string): ObsGraphNode[] {
    return this.nodesByRun.get(runId) ?? [];
  }

  getNodesBySignal(signalKind: ObsSignalKind): ObsGraphNode[] {
    return Array.from(this.nodes.values()).filter((n) =>
      n.signals.some((s) => s.kind === signalKind)
    );
  }

  getNodesByTimeRange(startIso: string, endIso: string): ObsGraphNode[] {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    return Array.from(this.nodes.values()).filter((n) => {
      const t = new Date(n.event.timestamp).getTime();
      return t >= start && t <= end;
    });
  }

  totalNodeCount(): number {
    return this.nodes.size;
  }

  waveNodeCounts(): Record<WaveSource, number> {
    const counts: Record<WaveSource, number> = {
      "wave-27": 0, "wave-28": 0, "wave-29": 0, "wave-30": 0, "wave-31": 0, "unknown": 0,
    };
    for (const [wave, nodes] of this.nodesByWave) {
      counts[wave] = nodes.length;
    }
    return counts;
  }
}

// ---------------------------------------------------------------------------
// GovernanceTelemetryEngine
// ---------------------------------------------------------------------------

/**
 * The GovernanceTelemetryEngine aggregates governance events from the
 * ObservabilityGraph and produces telemetry reports over configurable
 * time windows.
 */
export class GovernanceTelemetryEngine {
  private graph: ObservabilityGraph;

  constructor(graph: ObservabilityGraph) {
    this.graph = graph;
  }

  /**
   * Compute governance telemetry over all ingested events.
   */
  computeTelemetry(windowStart?: string, windowEnd?: string): GovernanceTelemetry {
    const nodes = windowStart && windowEnd
      ? this.graph.getNodesByTimeRange(windowStart, windowEnd)
      : this.graph.getAllNodes();

    const govNodes = nodes.filter((n) => WAVE_30_KINDS.has(n.event.kind));

    const decisionBreakdown: Record<PolicyResolutionResult["decision"], number> = {
      allow_winner: 0, deny_all: 0, escalate: 0, tie_break: 0,
    };
    const policyActivationFrequency: Record<string, number> = {};
    const conflictFrequency: Record<ConflictClass, number> = { soft: 0, hard: 0, structural: 0 };
    let overrideAttempts = 0;
    let reviewTokensIssued = 0;
    let forbiddenActionsSuppressed = 0;
    let totalArbitrations = 0;

    for (const node of govNodes) {
      const { kind, payload } = node.event;

      if (kind === "arbitration_begin") totalArbitrations++;

      if (kind === "arbitration_decision" || kind === "arbitration_escalate" || kind === "forbidden_action") {
        const decision = payload["decision"] as PolicyResolutionResult["decision"] | undefined;
        if (decision && decision in decisionBreakdown) {
          decisionBreakdown[decision]++;
        }
      }

      if (kind === "forbidden_action") forbiddenActionsSuppressed++;
      if (kind === "authority_override") overrideAttempts++;
      if (kind === "review_token_issued") reviewTokensIssued++;

      // Policy activation
      const policy = payload["policy"] as string | undefined;
      if (policy) {
        policyActivationFrequency[policy] = (policyActivationFrequency[policy] ?? 0) + 1;
      }

      // Conflict class
      if (kind === "arbitration_begin") {
        const cc = payload["conflictClass"] as ConflictClass | undefined;
        if (cc && cc in conflictFrequency) conflictFrequency[cc]++;
      }
    }

    // Find dominant policy
    let dominantPolicy: string | undefined;
    let maxFreq = 0;
    for (const [policy, freq] of Object.entries(policyActivationFrequency)) {
      if (freq > maxFreq) { maxFreq = freq; dominantPolicy = policy; }
    }

    const allTimestamps = nodes.map((n) => n.event.timestamp).sort();
    return {
      windowStart: windowStart ?? allTimestamps[0] ?? isoNow(),
      windowEnd: windowEnd ?? allTimestamps[allTimestamps.length - 1] ?? isoNow(),
      totalArbitrations,
      decisionBreakdown,
      policyActivationFrequency,
      overrideAttempts,
      reviewTokensIssued,
      forbiddenActionsSuppressed,
      dominantPolicy,
      conflictFrequency,
    };
  }
}

// ---------------------------------------------------------------------------
// TemporalCorrelationSystem
// ---------------------------------------------------------------------------

/**
 * The TemporalCorrelationSystem identifies causal relationships between
 * events from different harness waves and groups events into temporal clusters.
 */
export class TemporalCorrelationSystem {
  private graph: ObservabilityGraph;
  private correlations: CrossWaveCorrelation[] = [];

  constructor(graph: ObservabilityGraph) {
    this.graph = graph;
  }

  /**
   * Scan all ingested nodes for cross-wave correlations.
   * Returns all correlations found.
   */
  findCrossWaveCorrelations(): CrossWaveCorrelation[] {
    const allNodes = this.graph.getAllNodes().sort(
      (a, b) => new Date(a.event.timestamp).getTime() - new Date(b.event.timestamp).getTime()
    );

    const found: CrossWaveCorrelation[] = [];

    for (let i = 0; i < allNodes.length; i++) {
      const source = allNodes[i];
      // Look ahead up to 20 events for a correlated effect
      for (let j = i + 1; j < Math.min(i + 20, allNodes.length); j++) {
        const target = allNodes[j];
        if (source.waveSource === target.waveSource) continue;

        const correlation = this.detectCorrelation(source, target);
        if (correlation) {
          found.push(correlation);
          this.correlations.push(correlation);
        }
      }
    }

    return found;
  }

  /**
   * Cluster events into temporal windows.
   * Events within `windowMs` milliseconds of each other are grouped.
   */
  clusterByTime(windowMs: number): TemporalCluster[] {
    const allNodes = this.graph.getAllNodes().sort(
      (a, b) => new Date(a.event.timestamp).getTime() - new Date(b.event.timestamp).getTime()
    );

    if (allNodes.length === 0) return [];

    const clusters: TemporalCluster[] = [];
    let currentCluster: ObsGraphNode[] = [allNodes[0]];
    let clusterStart = new Date(allNodes[0].event.timestamp).getTime();

    for (let i = 1; i < allNodes.length; i++) {
      const t = new Date(allNodes[i].event.timestamp).getTime();
      if (t - clusterStart <= windowMs) {
        currentCluster.push(allNodes[i]);
      } else {
        clusters.push(this.buildCluster(currentCluster, windowMs));
        currentCluster = [allNodes[i]];
        clusterStart = t;
      }
    }
    if (currentCluster.length > 0) {
      clusters.push(this.buildCluster(currentCluster, windowMs));
    }

    return clusters;
  }

  getAllCorrelations(): CrossWaveCorrelation[] {
    return this.correlations;
  }

  // ---- Private helpers ----

  private detectCorrelation(
    source: ObsGraphNode,
    target: ObsGraphNode
  ): CrossWaveCorrelation | null {
    const sk = source.event.kind;
    const tk = target.event.kind;

    let correlationType: CrossWaveCorrelation["correlationType"] | null = null;
    let confidence = 0;

    // governance_block (wave-30) -> recovery_begin (wave-29)
    if (sk === "governance_block" && tk === "recovery_begin") {
      correlationType = "governance_to_recovery"; confidence = 0.85;
    }
    // failure_injected (wave-29) -> arbitration_begin (wave-30)
    else if (sk === "failure_injected" && tk === "arbitration_begin") {
      correlationType = "failure_to_arbitration"; confidence = 0.80;
    }
    // memory_drift (wave-28) -> conflict_detected (wave-30)
    else if (sk === "memory_drift" && tk === "conflict_detected") {
      correlationType = "memory_drift_to_conflict"; confidence = 0.70;
    }
    // review_token_issued (wave-30) -> failure_injected (wave-29)
    else if (sk === "review_token_issued" && tk === "failure_injected") {
      correlationType = "escalation_to_failure"; confidence = 0.65;
    }
    // recovery_complete (wave-29) -> governance_check (wave-30)
    else if (sk === "recovery_complete" && tk === "governance_check") {
      correlationType = "recovery_to_governance"; confidence = 0.75;
    }
    // Same event kind appearing in two different waves
    else if (sk === tk && source.waveSource !== target.waveSource) {
      correlationType = "pattern_repeat"; confidence = 0.55;
    }

    if (!correlationType) return null;

    return {
      correlationId: nextId("corr"),
      sourceEvent: source,
      targetEvent: target,
      sourceWave: source.waveSource,
      targetWave: target.waveSource,
      correlationType,
      confidence,
      detectedAt: isoNow(),
    };
  }

  private buildCluster(nodes: ObsGraphNode[], windowMs: number): TemporalCluster {
    const waves = new Set(nodes.map((n) => n.waveSource));
    const hasCrossWave = waves.size > 1;

    // Find dominant signal
    const signalCounts: Record<string, number> = {};
    for (const node of nodes) {
      for (const sig of node.signals) {
        signalCounts[sig.kind] = (signalCounts[sig.kind] ?? 0) + 1;
      }
    }
    let dominantSignal: ObsSignalKind | undefined;
    let maxCount = 0;
    for (const [kind, count] of Object.entries(signalCounts)) {
      if (count > maxCount) { maxCount = count; dominantSignal = kind as ObsSignalKind; }
    }

    return {
      clusterId: nextId("cluster"),
      events: nodes,
      windowMs,
      hasCrossWaveCorrelation: hasCrossWave,
      dominantSignal,
    };
  }
}

// ---------------------------------------------------------------------------
// SystemHealthModel
// ---------------------------------------------------------------------------

/**
 * The SystemHealthModel computes a composite health score from the
 * ObservabilityGraph, detects anomalies, and forecasts future drift.
 */
export class SystemHealthModel {
  private graph: ObservabilityGraph;
  private anomalies: ObsAnomaly[] = [];

  constructor(graph: ObservabilityGraph) {
    this.graph = graph;
  }

  /**
   * Compute a system health score over all ingested events.
   * Score ranges from 0.0 (completely unhealthy) to 1.0 (fully healthy).
   */
  computeHealthScore(windowMs?: number): SystemHealthScore {
    const allNodes = this.graph.getAllNodes();
    const windowNodes = windowMs
      ? this.filterByWindow(allNodes, windowMs)
      : allNodes;

    const components = {
      executionHealth: this.computeExecutionHealth(windowNodes),
      memoryHealth: this.computeMemoryHealth(windowNodes),
      governanceHealth: this.computeGovernanceHealth(windowNodes),
      recoveryHealth: this.computeRecoveryHealth(windowNodes),
      authorityHealth: this.computeAuthorityHealth(windowNodes),
    };

    // Weighted average: governance and recovery are weighted higher
    const score = (
      components.executionHealth * 0.20 +
      components.memoryHealth * 0.20 +
      components.governanceHealth * 0.25 +
      components.recoveryHealth * 0.25 +
      components.authorityHealth * 0.10
    );

    const activeAnomalies = this.detectAnomalies(windowNodes);
    const anomalyPenalty = Math.min(activeAnomalies.length * 0.05, 0.30);
    const finalScore = Math.max(0, score - anomalyPenalty);

    // Determine trend by comparing first and second half
    const trend = this.computeTrend(allNodes);

    return {
      computedAt: isoNow(),
      windowMs: windowMs ?? 0,
      score: Math.round(finalScore * 1000) / 1000,
      components,
      activeAnomalies,
      trend,
    };
  }

  /**
   * Detect anomalies in the current event set.
   */
  detectAnomalies(nodes?: ObsGraphNode[]): ObsAnomaly[] {
    const target = nodes ?? this.graph.getAllNodes();
    const anomalies: ObsAnomaly[] = [];

    // Governance spike: >5 arbitration events in the window
    const arbitrationNodes = target.filter((n) => n.event.kind === "arbitration_begin");
    if (arbitrationNodes.length > 5) {
      anomalies.push({
        anomalyId: nextId("anomaly"),
        detectedAt: isoNow(),
        triggeringEvents: arbitrationNodes.slice(0, 3),
        anomalyType: "governance_spike",
        severity: arbitrationNodes.length > 10 ? "high" : "medium",
        description: `Governance spike: ${arbitrationNodes.length} arbitration events detected`,
        isPreFailureSignal: arbitrationNodes.length > 10,
      });
    }

    // Failure cluster: >3 failure events in the window
    const failureNodes = target.filter((n) =>
      ["failure_injected", "failure_detected", "recovery_failed"].includes(n.event.kind)
    );
    if (failureNodes.length > 3) {
      anomalies.push({
        anomalyId: nextId("anomaly"),
        detectedAt: isoNow(),
        triggeringEvents: failureNodes.slice(0, 3),
        anomalyType: "failure_cluster",
        severity: failureNodes.length > 6 ? "critical" : "high",
        description: `Failure cluster: ${failureNodes.length} failure events detected`,
        isPreFailureSignal: true,
      });
    }

    // Authority escalation loop: >3 review tokens without resolution
    const tokenIssued = target.filter((n) => n.event.kind === "review_token_issued").length;
    const tokenResolved = target.filter((n) => n.event.kind === "review_token_resolved").length;
    if (tokenIssued - tokenResolved > 3) {
      anomalies.push({
        anomalyId: nextId("anomaly"),
        detectedAt: isoNow(),
        triggeringEvents: target.filter((n) => n.event.kind === "review_token_issued").slice(0, 3),
        anomalyType: "authority_escalation_loop",
        severity: "high",
        description: `Escalation loop: ${tokenIssued - tokenResolved} unresolved review tokens`,
        isPreFailureSignal: false,
      });
    }

    // Recovery failure rate: >50% of recoveries failed
    const recoveryBegin = target.filter((n) => n.event.kind === "recovery_begin").length;
    const recoveryFailed = target.filter((n) => n.event.kind === "recovery_failed").length;
    if (recoveryBegin > 0 && recoveryFailed / recoveryBegin > 0.5) {
      anomalies.push({
        anomalyId: nextId("anomaly"),
        detectedAt: isoNow(),
        triggeringEvents: target.filter((n) => n.event.kind === "recovery_failed").slice(0, 3),
        anomalyType: "recovery_failure_rate",
        severity: "critical",
        description: `Recovery failure rate: ${Math.round(recoveryFailed / recoveryBegin * 100)}% of recoveries failed`,
        isPreFailureSignal: true,
      });
    }

    this.anomalies.push(...anomalies);
    return anomalies;
  }

  /**
   * Compute a drift forecast from historical drift scores.
   */
  computeDriftForecast(
    historicalDriftScores: number[],
    alertThreshold = 0.3
  ): DriftForecast {
    if (historicalDriftScores.length === 0) {
      return {
        forecastId: nextId("forecast"),
        computedAt: isoNow(),
        historicalDriftScores: [],
        predictedDriftScore: 0,
        confidence: 0,
        exceedsAlertThreshold: false,
        alertThreshold,
      };
    }

    // Simple linear trend extrapolation
    const n = historicalDriftScores.length;
    const mean = historicalDriftScores.reduce((a, b) => a + b, 0) / n;

    // Compute slope using least-squares linear regression
    let sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumXY += i * (historicalDriftScores[i] - mean);
      sumX2 += i * i;
    }
    const slope = sumX2 > 0 ? sumXY / sumX2 : 0;
    const predicted = Math.max(0, Math.min(1, historicalDriftScores[n - 1] + slope));

    // Confidence: higher with more data points, lower with high variance
    const variance = historicalDriftScores.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    const confidence = Math.max(0, Math.min(1, (n / 10) * (1 - Math.sqrt(variance))));

    return {
      forecastId: nextId("forecast"),
      computedAt: isoNow(),
      historicalDriftScores,
      predictedDriftScore: Math.round(predicted * 1000) / 1000,
      confidence: Math.round(confidence * 1000) / 1000,
      exceedsAlertThreshold: predicted > alertThreshold,
      alertThreshold,
    };
  }

  getAllAnomalies(): ObsAnomaly[] {
    return this.anomalies;
  }

  // ---- Private health component calculators ----

  private computeExecutionHealth(nodes: ObsGraphNode[]): number {
    const total = nodes.filter((n) =>
      ["agent_start", "tool_call", "delegation"].includes(n.event.kind)
    ).length;
    if (total === 0) return 1.0;
    const errors = nodes.filter((n) => n.event.kind === "error").length;
    return Math.max(0, 1 - errors / total);
  }

  private computeMemoryHealth(nodes: ObsGraphNode[]): number {
    const writes = nodes.filter((n) => n.event.kind === "memory_write").length;
    if (writes === 0) return 1.0;
    const drifts = nodes.filter((n) => n.event.kind === "memory_drift").length;
    return Math.max(0, 1 - drifts / Math.max(writes, 1));
  }

  private computeGovernanceHealth(nodes: ObsGraphNode[]): number {
    const checks = nodes.filter((n) => n.event.kind === "governance_check").length;
    if (checks === 0) return 1.0;
    const blocks = nodes.filter((n) => n.event.kind === "governance_block").length;
    const forbidden = nodes.filter((n) => n.event.kind === "forbidden_action").length;
    // Blocks and forbidden actions are expected (they mean governance is working)
    // but a high ratio suggests systemic policy violations
    const violationRate = (blocks + forbidden) / Math.max(checks, 1);
    return Math.max(0, 1 - Math.min(violationRate * 0.5, 0.5));
  }

  private computeRecoveryHealth(nodes: ObsGraphNode[]): number {
    const begins = nodes.filter((n) => n.event.kind === "recovery_begin").length;
    const failed = nodes.filter((n) => n.event.kind === "recovery_failed").length;
    // If there are no recovery attempts but failures exist, penalize
    const failures = nodes.filter((n) =>
      ["failure_injected", "failure_detected"].includes(n.event.kind)
    ).length;
    if (begins === 0 && failures === 0) return 1.0;
    if (begins === 0 && failures > 0) return Math.max(0, 1 - failures * 0.15);
    const completed = nodes.filter((n) => n.event.kind === "recovery_complete").length;
    const successRate = completed / Math.max(begins, 1);
    const failureRate = failed / Math.max(begins, 1);
    return Math.max(0, successRate - failureRate);
  }

  private computeAuthorityHealth(nodes: ObsGraphNode[]): number {
    const arbitrations = nodes.filter((n) => n.event.kind === "arbitration_begin").length;
    if (arbitrations === 0) return 1.0;
    const overrides = nodes.filter((n) => n.event.kind === "authority_override").length;
    // Some overrides are expected; a high ratio suggests authority instability
    const overrideRate = overrides / Math.max(arbitrations, 1);
    return Math.max(0, 1 - Math.min(overrideRate * 0.3, 0.5));
  }

  private computeTrend(nodes: ObsGraphNode[]): SystemHealthScore["trend"] {
    if (nodes.length < 4) return "stable";
    const sorted = [...nodes].sort(
      (a, b) => new Date(a.event.timestamp).getTime() - new Date(b.event.timestamp).getTime()
    );
    const half = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, half);
    const secondHalf = sorted.slice(half);

    const firstFailures = firstHalf.filter((n) =>
      ["failure_injected", "recovery_failed", "governance_block"].includes(n.event.kind)
    ).length;
    const secondFailures = secondHalf.filter((n) =>
      ["failure_injected", "recovery_failed", "governance_block"].includes(n.event.kind)
    ).length;

    if (secondFailures < firstFailures * 0.7) return "improving";
    if (secondFailures > firstFailures * 1.3) return "degrading";
    return "stable";
  }

  private filterByWindow(nodes: ObsGraphNode[], windowMs: number): ObsGraphNode[] {
    if (nodes.length === 0) return [];
    const latest = Math.max(...nodes.map((n) => new Date(n.event.timestamp).getTime()));
    const cutoff = latest - windowMs;
    return nodes.filter((n) => new Date(n.event.timestamp).getTime() >= cutoff);
  }
}
