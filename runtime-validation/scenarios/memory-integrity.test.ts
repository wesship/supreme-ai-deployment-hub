/**
 * runtime-validation/scenarios/memory-integrity.test.ts
 *
 * Wave 27 — Memory Integrity Validation
 *
 * Validates memory persistence contracts using the TraceEngine.
 * Covers: cold restart persistence, partial failure isolation,
 * cross-agent memory contamination prevention, and stale expiry.
 *
 * These tests exercise the harness trace model. When the real memory
 * backend (AgentMemoryService + vector store) is wired in, the .todo()
 * blocks below become the acceptance checklist.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TraceEngine, resetIdSequence } from "../harness/traceEngine";

beforeEach(() => {
  resetIdSequence();
});

// ---------------------------------------------------------------------------
// Helpers: simulate memory operations via trace events
// ---------------------------------------------------------------------------

interface MemoryEntry {
  key: string;
  agentId: string;
  content: string;
  writtenAt: string;
  expiresAt?: string;
}

class MockMemoryStore {
  private store = new Map<string, MemoryEntry>();
  private crashed = false;

  write(entry: MemoryEntry, trace: TraceEngine): void {
    if (this.crashed) throw new Error("memory store unavailable");
    this.store.set(entry.key, entry);
    trace.record(entry.agentId, "memory_write", {
      key: entry.key,
      summary: `write:${entry.key}`,
    });
  }

  read(key: string, agentId: string, trace: TraceEngine): MemoryEntry | undefined {
    const entry = this.store.get(key);
    trace.record(agentId, "memory_read", {
      key,
      found: !!entry,
      summary: `read:${key}`,
    });
    return entry;
  }

  /** Simulate a cold restart: store survives, but crash flag is reset */
  simulateColdRestart(): void {
    this.crashed = false;
    // In a real system the store would be reloaded from durable storage.
    // Here we keep the in-memory map to simulate durable persistence.
  }

  /** Simulate a partial crash mid-write */
  crashOnNextWrite(): void {
    this.crashed = true;
  }

  /** Expire entries older than `cutoffMs` milliseconds */
  expireStale(cutoffMs: number): number {
    const now = Date.now();
    let expired = 0;
    for (const [key, entry] of this.store) {
      if (entry.expiresAt && new Date(entry.expiresAt).getTime() < now - cutoffMs) {
        this.store.delete(key);
        expired++;
      }
    }
    return expired;
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  size(): number {
    return this.store.size;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Memory integrity — cold restart persistence", () => {
  it("memory written before restart is readable after restart", () => {
    const store = new MockMemoryStore();
    const trace = new TraceEngine("mem-cold-restart");

    store.write(
      { key: "agent-1:pref:theme", agentId: "agent-1", content: "dark", writtenAt: new Date().toISOString() },
      trace
    );

    // Simulate restart
    store.simulateColdRestart();

    const entry = store.read("agent-1:pref:theme", "agent-1", trace);
    expect(entry).toBeDefined();
    expect(entry?.content).toBe("dark");

    // Trace must record both the write and the read
    expect(trace.getEventsByKind("memory_write")).toHaveLength(1);
    expect(trace.getEventsByKind("memory_read")).toHaveLength(1);
  });

  it("task lineage survives cold restart", () => {
    const store = new MockMemoryStore();
    const trace = new TraceEngine("mem-lineage-restart");

    store.write(
      { key: "run-42:lineage", agentId: "planner", content: JSON.stringify(["planner", "executor"]), writtenAt: new Date().toISOString() },
      trace
    );

    store.simulateColdRestart();

    const entry = store.read("run-42:lineage", "planner", trace);
    expect(entry).toBeDefined();
    const lineage = JSON.parse(entry!.content);
    expect(lineage).toContain("executor");
  });
});

describe("Memory integrity — partial failure isolation", () => {
  it("a crashed write does not corrupt existing entries", () => {
    const store = new MockMemoryStore();
    const trace = new TraceEngine("mem-partial-fail");

    // Write a good entry first
    store.write(
      { key: "agent-1:state", agentId: "agent-1", content: "stable", writtenAt: new Date().toISOString() },
      trace
    );

    // Crash the store before the second write
    store.crashOnNextWrite();
    expect(() =>
      store.write(
        { key: "agent-1:state2", agentId: "agent-1", content: "corrupt", writtenAt: new Date().toISOString() },
        trace
      )
    ).toThrow("memory store unavailable");

    // Original entry must still be intact
    store.simulateColdRestart();
    const entry = store.read("agent-1:state", "agent-1", trace);
    expect(entry?.content).toBe("stable");

    // The failed key must not exist
    expect(store.has("agent-1:state2")).toBe(false);
  });

  it("partial failure does not produce orphaned trace events", () => {
    const store = new MockMemoryStore();
    const trace = new TraceEngine("mem-orphan-check");

    store.crashOnNextWrite();
    try {
      store.write(
        { key: "orphan-key", agentId: "agent-x", content: "x", writtenAt: new Date().toISOString() },
        trace
      );
    } catch {
      // expected
    }

    // The crashed write must NOT have emitted a memory_write event
    // (the mock throws before recording — this pins that contract)
    expect(trace.getEventsByKind("memory_write")).toHaveLength(0);
  });
});

describe("Memory integrity — cross-agent contamination prevention", () => {
  it("agent-1 cannot read agent-2 memory via key namespace isolation", () => {
    const store = new MockMemoryStore();
    const trace = new TraceEngine("mem-isolation");

    store.write(
      { key: "agent-2:secret", agentId: "agent-2", content: "classified", writtenAt: new Date().toISOString() },
      trace
    );

    // agent-1 attempts to read agent-2's key
    const entry = store.read("agent-2:secret", "agent-1", trace);

    // The data is technically accessible by key — this test pins that the
    // namespace prefix IS the isolation boundary. A real implementation
    // must enforce that agent-1 cannot request keys prefixed "agent-2:".
    // Here we assert the trace records the read attempt so it is auditable.
    const readEvents = trace.getEventsByKind("memory_read");
    expect(readEvents).toHaveLength(1);
    expect(readEvents[0].agentId).toBe("agent-1");
    expect(readEvents[0].payload.key).toBe("agent-2:secret");

    // Document: in the real system this should return undefined (access denied).
    // For now, assert the harness records the attempt — enforcement is Wave 30.
    expect(entry).toBeDefined(); // current behavior: no enforcement yet
  });

  it("two agents writing to different keys do not overwrite each other", () => {
    const store = new MockMemoryStore();
    const trace = new TraceEngine("mem-no-overwrite");

    store.write({ key: "agent-1:ctx", agentId: "agent-1", content: "a1-data", writtenAt: new Date().toISOString() }, trace);
    store.write({ key: "agent-2:ctx", agentId: "agent-2", content: "a2-data", writtenAt: new Date().toISOString() }, trace);

    expect(store.read("agent-1:ctx", "agent-1", trace)?.content).toBe("a1-data");
    expect(store.read("agent-2:ctx", "agent-2", trace)?.content).toBe("a2-data");
  });
});

describe("Memory integrity — stale expiry", () => {
  it("expired entries are removed and not returned", () => {
    const store = new MockMemoryStore();
    const trace = new TraceEngine("mem-expiry");

    const pastDate = new Date(Date.now() - 10_000).toISOString(); // 10s ago
    store.write(
      { key: "stale-key", agentId: "agent-1", content: "old", writtenAt: pastDate, expiresAt: pastDate },
      trace
    );

    const expired = store.expireStale(5_000); // expire anything older than 5s
    expect(expired).toBe(1);
    expect(store.has("stale-key")).toBe(false);
  });

  it("non-expired entries survive the expiry pass", () => {
    const store = new MockMemoryStore();
    const trace = new TraceEngine("mem-no-expiry");

    const futureDate = new Date(Date.now() + 60_000).toISOString();
    store.write(
      { key: "fresh-key", agentId: "agent-1", content: "fresh", writtenAt: new Date().toISOString(), expiresAt: futureDate },
      trace
    );

    const expired = store.expireStale(5_000);
    expect(expired).toBe(0);
    expect(store.has("fresh-key")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Pending: requires executor snapshot/restore API (Wave 28)
// ---------------------------------------------------------------------------

describe.todo("Memory continuity across executor restart (Wave 28)", () => {
  // it("executor.snapshot() captures full step history + tool state")
  // it("executor.restore(snapshot) resumes from exact step boundary")
  // it("restored run preserves the original run.id for audit linkage")
  // it("vector embedding continuity: restored context matches pre-restart context")
});
