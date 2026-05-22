/**
 * Phase 4 (P1) — Live Replay Debugger
 *
 * Bridges the gap between observed behavior and reconstructed behavior.
 * Supports three replay modes:
 *   - live: real-time execution mirror
 *   - delayed: post-execution validation
 *   - forensic: failure reconstruction
 */

export type ReplayMode = "live" | "delayed" | "forensic";

export interface ExecutionEvent {
  eventId: string;
  executionId: string;
  type: "step" | "memory_read" | "memory_write" | "governance_decision" | "tool_call" | "error";
  payload: unknown;
  timestamp: number;
}

export interface ReplayDiff {
  eventId: string;
  type: "match" | "diverge" | "missing" | "extra";
  originalPayload?: unknown;
  replayedPayload?: unknown;
  description: string;
}

export interface ReplaySession {
  sessionId: string;
  executionId: string;
  mode: ReplayMode;
  startedAt: string;
  completedAt?: string;
  diffs: ReplayDiff[];
  divergenceScore: number;
}

export class LiveReplayDebugger {
  private readonly sessions = new Map<string, ReplaySession>();
  private readonly originalTraces = new Map<string, ExecutionEvent[]>();

  /**
   * Register the original execution trace for a given execution.
   * Must be called before starting a replay session.
   */
  registerTrace(executionId: string, events: ExecutionEvent[]): void {
    this.originalTraces.set(executionId, [...events].sort((a, b) => a.timestamp - b.timestamp));
  }

  /** Start a new replay session for a given execution. */
  startSession(executionId: string, mode: ReplayMode): ReplaySession {
    const sessionId = `replay-${executionId}-${Date.now()}`;
    const session: ReplaySession = {
      sessionId,
      executionId,
      mode,
      startedAt: new Date().toISOString(),
      diffs: [],
      divergenceScore: 0,
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Feed a replayed event into an active session.
   * Compares it against the original trace and records any divergence.
   */
  feedEvent(sessionId: string, replayedEvent: ExecutionEvent): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Replay session '${sessionId}' not found`);

    const originalEvents = this.originalTraces.get(session.executionId) ?? [];
    const matchingOriginal = originalEvents.find((e) => e.eventId === replayedEvent.eventId);

    if (!matchingOriginal) {
      session.diffs.push({
        eventId: replayedEvent.eventId,
        type: "extra",
        replayedPayload: replayedEvent.payload,
        description: `Event '${replayedEvent.eventId}' appeared in replay but not in original trace`,
      });
    } else {
      const originalJson = JSON.stringify(matchingOriginal.payload);
      const replayedJson = JSON.stringify(replayedEvent.payload);

      if (originalJson !== replayedJson) {
        session.diffs.push({
          eventId: replayedEvent.eventId,
          type: "diverge",
          originalPayload: matchingOriginal.payload,
          replayedPayload: replayedEvent.payload,
          description: `Payload divergence for event '${replayedEvent.eventId}'`,
        });
      } else {
        session.diffs.push({
          eventId: replayedEvent.eventId,
          type: "match",
          description: `Event '${replayedEvent.eventId}' matches original`,
        });
      }
    }

    session.divergenceScore = this.computeDivergenceScore(session);
  }

  /** Complete a replay session and check for missing events. */
  completeSession(sessionId: string): ReplaySession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Replay session '${sessionId}' not found`);

    const originalEvents = this.originalTraces.get(session.executionId) ?? [];
    const replayedEventIds = new Set(
      session.diffs.map((d) => d.eventId)
    );

    for (const originalEvent of originalEvents) {
      if (!replayedEventIds.has(originalEvent.eventId)) {
        session.diffs.push({
          eventId: originalEvent.eventId,
          type: "missing",
          originalPayload: originalEvent.payload,
          description: `Event '${originalEvent.eventId}' present in original but missing from replay`,
        });
      }
    }

    session.divergenceScore = this.computeDivergenceScore(session);
    session.completedAt = new Date().toISOString();
    return session;
  }

  getSession(sessionId: string): ReplaySession | undefined {
    return this.sessions.get(sessionId);
  }

  private computeDivergenceScore(session: ReplaySession): number {
    const total = session.diffs.length;
    if (total === 0) return 0;
    const diverged = session.diffs.filter((d) => d.type !== "match").length;
    return diverged / total;
  }
}

/** Singleton replay debugger. */
export const replayDebugger = new LiveReplayDebugger();
