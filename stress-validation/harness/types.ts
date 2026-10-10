/**
 * stress-validation/harness/types.ts
 *
 * Shared types for the Operational Stress Intelligence program (LS-1 through LS-6).
 *
 * Design principles:
 * - All measurements are deterministic snapshots, not live streams
 * - All thresholds are explicit and testable
 * - All results are serializable to JSON for CI reporting
 */

// ---------------------------------------------------------------------------
// Core measurement primitives
// ---------------------------------------------------------------------------

/** A single latency sample in milliseconds */
export interface LatencySample {
  readonly operationId: string;
  readonly operationType: "arbitration" | "replay" | "memory_read" | "memory_write" | "trace_write" | "governance_check" | "recovery";
  readonly durationMs: number;
  readonly timestamp: string;  // ISO 8601
  readonly agentId: string;
  readonly runId: string;
}

/** A throughput measurement over a time window */
export interface ThroughputMeasurement {
  readonly windowStartMs: number;
  readonly windowEndMs: number;
  readonly operationsCompleted: number;
  readonly operationsFailed: number;
  readonly operationsPerSecond: number;
  readonly errorRate: number;  // 0.0 - 1.0
}

/** A queue depth snapshot */
export interface QueueDepthSnapshot {
  readonly timestamp: string;
  readonly queueName: "replay" | "arbitration" | "recovery" | "telemetry" | "trace";
  readonly depth: number;
  readonly maxObservedDepth: number;
  readonly isSaturated: boolean;
}

/** A resource utilization snapshot */
export interface ResourceSnapshot {
  readonly timestamp: string;
  readonly heapUsedBytes: number;
  readonly heapTotalBytes: number;
  readonly externalBytes: number;
  readonly gcPauseMs: number;
  readonly activeHandles: number;
  readonly activeRequests: number;
}

// ---------------------------------------------------------------------------
// LS-1: Synthetic Concurrency
// ---------------------------------------------------------------------------

export interface ConcurrencyTestConfig {
  readonly concurrentAgents: number;
  readonly operationsPerAgent: number;
  readonly operationDelayMs: number;
  readonly warmupRounds: number;
  readonly measurementRounds: number;
}

export interface ConcurrencyResult {
  readonly config: ConcurrencyTestConfig;
  readonly latencySamples: LatencySample[];
  readonly throughput: ThroughputMeasurement;
  readonly queueSnapshots: QueueDepthSnapshot[];
  readonly p50LatencyMs: number;
  readonly p95LatencyMs: number;
  readonly p99LatencyMs: number;
  readonly maxLatencyMs: number;
  readonly throughputCeiling: number;  // ops/sec at which error rate exceeds 1%
  readonly saturationPoint: number;    // concurrent agents at which queue saturates
  readonly passed: boolean;
  readonly violations: string[];
}

// ---------------------------------------------------------------------------
// LS-2: Long-Duration Stability
// ---------------------------------------------------------------------------

export interface DriftSample {
  readonly epochMs: number;
  readonly driftScore: number;          // 0.0 = no drift, 1.0 = complete divergence
  readonly embeddingCosineSimilarity: number;
  readonly stateHashBefore: string;
  readonly stateHashAfter: string;
  readonly driftDetected: boolean;
}

export interface OrphanExecutionRecord {
  readonly runId: string;
  readonly agentId: string;
  readonly startedAt: string;
  readonly lastSeenAt: string;
  readonly ageMs: number;
  readonly isOrphaned: boolean;  // true if no completion event within timeout
}

export interface LongDurationResult {
  readonly durationMs: number;
  readonly epochCount: number;
  readonly driftSamples: DriftSample[];
  readonly orphanExecutions: OrphanExecutionRecord[];
  readonly maxDriftScore: number;
  readonly avgDriftScore: number;
  readonly orphanRate: number;  // 0.0 - 1.0
  readonly telemetryDegradationDetected: boolean;
  readonly passed: boolean;
  readonly violations: string[];
}

// ---------------------------------------------------------------------------
// LS-3: Failure Storm
// ---------------------------------------------------------------------------

export type FailureInjectionType =
  | "orchestrator_kill"
  | "redis_partition"
  | "vector_db_latency_spike"
  | "delayed_telemetry_write"
  | "governance_timeout_cascade"
  | "network_partition"
  | "memory_pressure"
  | "replay_queue_flood";

export interface FailureInjectionSpec {
  readonly type: FailureInjectionType;
  readonly durationMs: number;
  readonly intensity: "low" | "medium" | "high" | "extreme";
  readonly targetComponent: string;
}

export interface FailureStormResult {
  readonly injections: FailureInjectionSpec[];
  readonly replayDeterminismRate: number;   // 0.0 - 1.0 (must be 1.0)
  readonly recoverySuccessRate: number;     // 0.0 - 1.0 (must be >0.999)
  readonly governanceBypassAttempts: number; // must be 0
  readonly governanceBypassSuccesses: number; // must be 0
  readonly cascadeDepth: number;            // max observed cascade length
  readonly queueStarvationEvents: number;
  readonly passed: boolean;
  readonly violations: string[];
}

// ---------------------------------------------------------------------------
// LS-4: Governance Saturation
// ---------------------------------------------------------------------------

export interface GovernanceSaturationConfig {
  readonly conflictingAgents: number;
  readonly conflictsPerSecond: number;
  readonly escalationDepth: number;
  readonly durationMs: number;
}

export interface ArbitrationLatencyProfile {
  readonly conflictClass: "soft" | "hard" | "structural";
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  readonly deadlockCount: number;
  readonly resolutionSuccessRate: number;
}

export interface GovernanceSaturationResult {
  readonly config: GovernanceSaturationConfig;
  readonly latencyProfiles: ArbitrationLatencyProfile[];
  readonly totalConflictsProcessed: number;
  readonly totalDeadlocks: number;
  readonly maxArbitrationQueueDepth: number;
  readonly authorityResolutionLatencyMs: number;
  readonly escalationFloodHandled: boolean;
  readonly passed: boolean;
  readonly violations: string[];
}

// ---------------------------------------------------------------------------
// LS-5: Observability Scaling
// ---------------------------------------------------------------------------

export interface TraceCardinalityMeasurement {
  readonly eventCount: number;
  readonly uniqueRunIds: number;
  readonly uniqueAgentIds: number;
  readonly graphNodeCount: number;
  readonly graphEdgeCount: number;
  readonly queryLatencyMs: number;
  readonly ingestLatencyMs: number;
  readonly memoryFootprintBytes: number;
}

export interface ObservabilityScalingResult {
  readonly cardinalityMeasurements: TraceCardinalityMeasurement[];
  readonly maxEventCount: number;
  readonly queryLatencyDegradationFactor: number;  // ratio of p99 at max vs baseline
  readonly ingestBackpressureDetected: boolean;
  readonly causalGraphScalingFactor: number;        // nodes/ms at peak
  readonly passed: boolean;
  readonly violations: string[];
}

// ---------------------------------------------------------------------------
// LS-6: Distributed Execution Rehearsal
// ---------------------------------------------------------------------------

export interface OrchestratorNode {
  readonly nodeId: string;
  readonly region: string;
  readonly isPartitioned: boolean;
  readonly agentCount: number;
}

export interface CrossNodeReplaySyncResult {
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly replayLagMs: number;
  readonly deterministicMatch: boolean;
  readonly divergenceDetected: boolean;
}

export interface DistributedExecutionResult {
  readonly nodes: OrchestratorNode[];
  readonly partitionEvents: number;
  readonly crossNodeReplays: CrossNodeReplaySyncResult[];
  readonly distributedArbitrationResults: { conflictId: string; allNodesAgree: boolean }[];
  readonly splitBrainDetected: boolean;
  readonly consensusRate: number;  // 0.0 - 1.0 (must be 1.0 for governance decisions)
  readonly passed: boolean;
  readonly violations: string[];
}

// ---------------------------------------------------------------------------
// Aggregate stress report
// ---------------------------------------------------------------------------

export interface StressValidationReport {
  readonly generatedAt: string;
  readonly ls1?: ConcurrencyResult;
  readonly ls2?: LongDurationResult;
  readonly ls3?: FailureStormResult;
  readonly ls4?: GovernanceSaturationResult;
  readonly ls5?: ObservabilityScalingResult;
  readonly ls6?: DistributedExecutionResult;
  readonly overallPassed: boolean;
  readonly failedStages: string[];
  readonly successMetrics: {
    replayDeterminism: number;
    arbitrationConsistency: number;
    governanceBypassRate: number;
    memoryContinuityDrift: number;
    traceLossRate: number;
    recoverySuccessRate: number;
  };
}

// ---------------------------------------------------------------------------
// Success thresholds (from the program specification)
// ---------------------------------------------------------------------------

export const STRESS_THRESHOLDS = {
  REPLAY_DETERMINISM_MIN: 1.0,           // 100%
  ARBITRATION_CONSISTENCY_MIN: 1.0,      // 100%
  GOVERNANCE_BYPASS_RATE_MAX: 0.0,       // 0%
  MEMORY_CONTINUITY_DRIFT_MAX: 0.01,     // <1%
  TRACE_LOSS_RATE_MAX: 0.0,              // 0%
  RECOVERY_SUCCESS_RATE_MIN: 0.999,      // >99.9%
  LONG_DURATION_STABILITY_MS: 72 * 60 * 60 * 1000,  // 72h (simulated)
  CONCURRENCY_P99_LATENCY_MAX_MS: 500,   // 500ms p99 for arbitration
  GOVERNANCE_SATURATION_DEADLOCK_MAX: 0, // zero deadlocks
} as const;
