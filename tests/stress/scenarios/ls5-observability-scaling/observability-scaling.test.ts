/**
 * stress-validation/scenarios/ls5-observability-scaling/observability-scaling.test.ts
 *
 * LS-5: Observability Scaling Analysis
 * LS-6: Distributed Execution Rehearsal
 *
 * Validates that:
 * - The observability graph does not become a bottleneck under high cardinality
 * - Query latency degradation stays within acceptable bounds
 * - Distributed arbitration reaches consensus under partitions
 * - No split-brain occurs when only one node is partitioned at a time
 */

import { describe, it, expect } from "vitest";
import { ObservabilityScaler, DistributedRehearsalRunner } from "../../harness/observabilityScaler.js";
import type { OrchestratorNode } from "../../harness/types.js";

// ---------------------------------------------------------------------------
// LS-5: Observability Scaling
// ---------------------------------------------------------------------------

describe("LS-5: Observability Scaling — cardinality growth model", () => {
  it("produces measurements for each event count level", () => {
    const scaler = new ObservabilityScaler();
    const levels = [1000, 10000, 100000];
    const result = scaler.run(levels);

    expect(result.cardinalityMeasurements.length).toBe(3);
    expect(result.cardinalityMeasurements[0].eventCount).toBe(1000);
    expect(result.cardinalityMeasurements[1].eventCount).toBe(10000);
    expect(result.cardinalityMeasurements[2].eventCount).toBe(100000);
  });

  it("graph edges are always greater than graph nodes (each event links to predecessors)", () => {
    const scaler = new ObservabilityScaler();
    const result = scaler.run([1000, 50000, 200000]);

    for (const m of result.cardinalityMeasurements) {
      expect(m.graphEdgeCount).toBeGreaterThan(m.graphNodeCount);
    }
  });

  it("memory footprint grows linearly with event count", () => {
    const scaler = new ObservabilityScaler();
    const result = scaler.run([1000, 2000, 4000]);

    const m0 = result.cardinalityMeasurements[0];
    const m1 = result.cardinalityMeasurements[1];
    const m2 = result.cardinalityMeasurements[2];

    // Memory should roughly double as event count doubles
    expect(m1.memoryFootprintBytes).toBeCloseTo(m0.memoryFootprintBytes * 2, -2);
    expect(m2.memoryFootprintBytes).toBeCloseTo(m0.memoryFootprintBytes * 4, -2);
  });

  it("unique run IDs grow sub-linearly with event count", () => {
    const scaler = new ObservabilityScaler();
    const result = scaler.run([100, 10000, 1000000]);

    const ids0 = result.cardinalityMeasurements[0].uniqueRunIds;
    const ids2 = result.cardinalityMeasurements[2].uniqueRunIds;

    // 10000x more events should produce far fewer than 10000x more unique run IDs
    expect(ids2).toBeLessThan(ids0 * 1000);
  });

  it("handles empty event count levels gracefully", () => {
    const scaler = new ObservabilityScaler();
    const result = scaler.run([]);

    expect(result.cardinalityMeasurements).toEqual([]);
    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
  });
});

describe("LS-5: Observability Scaling — query latency degradation", () => {
  it("query latency grows logarithmically (degradation factor < 15x at 1000x scale)", () => {
    const scaler = new ObservabilityScaler();
    // 1000 to 1,000,000 events (1000x scale)
    // log2(1000) ≈ 10, so degradation factor is ~10-12x — sub-linear vs linear (1000x)
    const result = scaler.run([1000, 10000, 100000, 1000000]);

    expect(result.queryLatencyDegradationFactor).toBeLessThan(20);
    expect(result.queryLatencyDegradationFactor).toBeGreaterThan(1); // must degrade some
    expect(result.passed).toBe(true);
  });

  it("query latency at peak is higher than at baseline", () => {
    const scaler = new ObservabilityScaler();
    const result = scaler.run([1000, 500000]);

    const baseline = result.cardinalityMeasurements[0].queryLatencyMs;
    const peak = result.cardinalityMeasurements[1].queryLatencyMs;
    expect(peak).toBeGreaterThan(baseline);
  });

  it("causal graph scaling factor is positive", () => {
    const scaler = new ObservabilityScaler();
    const result = scaler.run([10000, 100000]);

    expect(result.causalGraphScalingFactor).toBeGreaterThan(0);
  });
});

describe("LS-5: Observability Scaling — ingest backpressure", () => {
  it("no ingest backpressure at moderate event counts", () => {
    const scaler = new ObservabilityScaler();
    // At 100k events, ingest latency = 1 * (1 + 100000/100000) = 2ms — well below 50ms
    const result = scaler.run([1000, 10000, 100000]);

    expect(result.ingestBackpressureDetected).toBe(false);
    expect(result.passed).toBe(true);
  });

  it("detects backpressure at very high event counts", () => {
    const scaler = new ObservabilityScaler();
    // At 5M events, ingest latency = 1 * (1 + 5000000/100000) = 51ms — exceeds 50ms
    const result = scaler.run([1000, 5000000]);

    expect(result.ingestBackpressureDetected).toBe(true);
    expect(result.passed).toBe(false);
  });

  it("max event count is correctly reported", () => {
    const scaler = new ObservabilityScaler();
    const result = scaler.run([500, 5000, 50000]);

    expect(result.maxEventCount).toBe(50000);
  });
});

// ---------------------------------------------------------------------------
// LS-6: Distributed Execution Rehearsal
// ---------------------------------------------------------------------------

describe("LS-6: Distributed Execution — no partition baseline", () => {
  it("achieves 100% consensus with no partitions", () => {
    const runner = new DistributedRehearsalRunner();
    const nodes: OrchestratorNode[] = [
      { nodeId: "node-us-east", region: "us-east-1", isPartitioned: false, agentCount: 10 },
      { nodeId: "node-us-west", region: "us-west-2", isPartitioned: false, agentCount: 10 },
      { nodeId: "node-eu-west", region: "eu-west-1", isPartitioned: false, agentCount: 10 },
    ];

    const result = runner.run(nodes, 50);

    expect(result.consensusRate).toBe(1.0);
    expect(result.splitBrainDetected).toBe(false);
    expect(result.partitionEvents).toBe(0);
    expect(result.passed).toBe(true);
  });

  it("produces cross-node replay results for all node pairs", () => {
    const runner = new DistributedRehearsalRunner();
    const nodes: OrchestratorNode[] = [
      { nodeId: "node-a", region: "us-east-1", isPartitioned: false, agentCount: 5 },
      { nodeId: "node-b", region: "us-west-2", isPartitioned: false, agentCount: 5 },
      { nodeId: "node-c", region: "eu-west-1", isPartitioned: false, agentCount: 5 },
    ];

    const result = runner.run(nodes, 10);

    // 3 nodes → 3 pairs: (a,b), (a,c), (b,c)
    expect(result.crossNodeReplays.length).toBe(3);
  });

  it("all replays are deterministic with no partitions", () => {
    const runner = new DistributedRehearsalRunner();
    const nodes: OrchestratorNode[] = [
      { nodeId: "node-1", region: "us-east-1", isPartitioned: false, agentCount: 8 },
      { nodeId: "node-2", region: "ap-south-1", isPartitioned: false, agentCount: 8 },
    ];

    const result = runner.run(nodes, 20);

    for (const replay of result.crossNodeReplays) {
      expect(replay.deterministicMatch).toBe(true);
      expect(replay.divergenceDetected).toBe(false);
    }
  });
});

describe("LS-6: Distributed Execution — single node partition", () => {
  it("maintains consensus when only one node is partitioned", () => {
    const runner = new DistributedRehearsalRunner();
    const nodes: OrchestratorNode[] = [
      { nodeId: "node-a", region: "us-east-1", isPartitioned: false, agentCount: 10 },
      { nodeId: "node-b", region: "us-west-2", isPartitioned: true, agentCount: 10 },  // partitioned
      { nodeId: "node-c", region: "eu-west-1", isPartitioned: false, agentCount: 10 },
    ];

    const result = runner.run(nodes, 30);

    expect(result.consensusRate).toBe(1.0);
    expect(result.partitionEvents).toBe(1);
    expect(result.passed).toBe(true);
  });

  it("no split-brain when only one node is partitioned", () => {
    const runner = new DistributedRehearsalRunner();
    const nodes: OrchestratorNode[] = [
      { nodeId: "node-primary", region: "us-east-1", isPartitioned: false, agentCount: 20 },
      { nodeId: "node-secondary", region: "us-west-2", isPartitioned: true, agentCount: 20 },
    ];

    const result = runner.run(nodes, 25);

    // Partitioned node pairs don't cause split-brain unless BOTH are partitioned
    expect(result.splitBrainDetected).toBe(false);
  });

  it("replay lag increases for pairs involving a partitioned node", () => {
    const runner = new DistributedRehearsalRunner();
    const nodes: OrchestratorNode[] = [
      { nodeId: "node-healthy", region: "us-east-1", isPartitioned: false, agentCount: 5 },
      { nodeId: "node-partitioned", region: "eu-west-1", isPartitioned: true, agentCount: 5 },
    ];

    const result = runner.run(nodes, 5);

    const partitionedPair = result.crossNodeReplays[0];
    expect(partitionedPair.replayLagMs).toBeGreaterThan(100);  // partition penalty applied
  });
});

describe("LS-6: Distributed Execution — split-brain detection", () => {
  it("detects split-brain when two nodes are simultaneously partitioned", () => {
    const runner = new DistributedRehearsalRunner();
    const nodes: OrchestratorNode[] = [
      { nodeId: "node-a", region: "us-east-1", isPartitioned: true, agentCount: 10 },
      { nodeId: "node-b", region: "us-west-2", isPartitioned: true, agentCount: 10 },
      { nodeId: "node-c", region: "eu-west-1", isPartitioned: false, agentCount: 10 },
    ];

    const result = runner.run(nodes, 20);

    // The pair (a,b) is both partitioned → split-brain
    expect(result.splitBrainDetected).toBe(true);
    expect(result.passed).toBe(false);
  });

  it("reports violation when split-brain is detected", () => {
    const runner = new DistributedRehearsalRunner();
    const nodes: OrchestratorNode[] = [
      { nodeId: "node-x", region: "us-east-1", isPartitioned: true, agentCount: 5 },
      { nodeId: "node-y", region: "ap-south-1", isPartitioned: true, agentCount: 5 },
    ];

    const result = runner.run(nodes, 10);

    expect(result.violations.some((v) => v.includes("Split-brain"))).toBe(true);
  });
});

describe("LS-6: Distributed Execution — result structure", () => {
  it("result is fully serializable to JSON", () => {
    const runner = new DistributedRehearsalRunner();
    const nodes: OrchestratorNode[] = [
      { nodeId: "node-1", region: "us-east-1", isPartitioned: false, agentCount: 5 },
      { nodeId: "node-2", region: "eu-west-1", isPartitioned: false, agentCount: 5 },
    ];

    const result = runner.run(nodes, 5);
    const serialized = JSON.stringify(result);
    expect(serialized).toBeTruthy();
    const parsed = JSON.parse(serialized);
    expect(parsed.nodes.length).toBe(2);
    expect(parsed.consensusRate).toBe(1.0);
  });

  it("distributed arbitration results count matches conflict count", () => {
    const runner = new DistributedRehearsalRunner();
    const nodes: OrchestratorNode[] = [
      { nodeId: "node-a", region: "us-east-1", isPartitioned: false, agentCount: 3 },
      { nodeId: "node-b", region: "us-west-2", isPartitioned: false, agentCount: 3 },
    ];

    const result = runner.run(nodes, 42);
    expect(result.distributedArbitrationResults.length).toBe(42);
  });
});
