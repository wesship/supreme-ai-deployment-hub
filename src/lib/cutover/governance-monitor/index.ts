/**
 * Phase 2 — Real-Time Governance Monitoring
 *
 * Tracks arbitration health signals, fires alerts when thresholds are breached,
 * and answers the critical insight: "Is governance slowing execution or protecting it?"
 */

export type GovernanceAlertLevel = "info" | "warning" | "critical";
export type GovernanceResolution = "allow" | "deny" | "escalate" | "mitigate";

export interface ArbitrationEvent {
  conflictId: string;
  resolution: GovernanceResolution;
  latencyMs: number;
  policyCount: number;
  isRetry: boolean;
  timestamp: number;
}

export interface GovernanceMetrics {
  /** p50 arbitration latency in ms over the observation window */
  latencyP50Ms: number;
  /** p95 arbitration latency in ms */
  latencyP95Ms: number;
  /** p99 arbitration latency in ms */
  latencyP99Ms: number;
  /** Conflicts per second */
  conflictRate: number;
  /** Fraction of decisions that resulted in deny */
  denyRate: number;
  /** Fraction of decisions that required escalation */
  escalationRate: number;
  /** Number of detected retry loops in the window */
  retryLoopCount: number;
  /** Total decisions in the observation window */
  totalDecisions: number;
  /** Answer to the critical insight question */
  governanceClassification: "protecting" | "slowing" | "neutral";
}

export interface GovernanceAlert {
  level: GovernanceAlertLevel;
  metric: string;
  value: number;
  threshold: number;
  message: string;
  timestamp: string;
}

/** Alert thresholds derived from the cutover plan specification. */
const ALERT_THRESHOLDS = {
  latencyP95WarnMs: 150,
  latencyP95CritMs: 200,
  conflictRateIncreasePercent: 30,
  retryLoopWarnCount: 3,
  retryLoopCritCount: 10,
  denyRateCritPercent: 0.5,
  escalationRateCritPercent: 0.2,
};

export class GovernanceMonitor {
  private readonly windowMs: number;
  private readonly events: ArbitrationEvent[] = [];
  private baselineConflictRate: number | null = null;
  private readonly alertHandlers: Array<(alert: GovernanceAlert) => void> = [];

  constructor(windowMs = 60_000) {
    this.windowMs = windowMs;
  }

  /** Record a completed arbitration event. */
  record(event: ArbitrationEvent): void {
    this.events.push(event);
    this.pruneWindow();
    this.checkAlerts();
  }

  /** Register an alert handler (e.g., to emit to OTLP or PagerDuty). */
  onAlert(handler: (alert: GovernanceAlert) => void): void {
    this.alertHandlers.push(handler);
  }

  /** Set the baseline conflict rate for relative spike detection. */
  setBaseline(conflictRatePerSecond: number): void {
    this.baselineConflictRate = conflictRatePerSecond;
  }

  /** Compute current governance metrics over the observation window. */
  getMetrics(): GovernanceMetrics {
    this.pruneWindow();
    const events = this.events;
    const total = events.length;

    if (total === 0) {
      return {
        latencyP50Ms: 0, latencyP95Ms: 0, latencyP99Ms: 0,
        conflictRate: 0, denyRate: 0, escalationRate: 0,
        retryLoopCount: 0, totalDecisions: 0,
        governanceClassification: "neutral",
      };
    }

    const latencies = events.map((e) => e.latencyMs).sort((a, b) => a - b);
    const p50 = percentile(latencies, 50);
    const p95 = percentile(latencies, 95);
    const p99 = percentile(latencies, 99);

    const windowSeconds = this.windowMs / 1000;
    const conflictRate = total / windowSeconds;
    const denyRate = events.filter((e) => e.resolution === "deny").length / total;
    const escalationRate = events.filter((e) => e.resolution === "escalate").length / total;
    const retryLoopCount = events.filter((e) => e.isRetry).length;

    // Classification: if p95 latency is below warn threshold and deny rate is
    // below 10%, governance is protecting. If latency is high, it is slowing.
    let governanceClassification: GovernanceMetrics["governanceClassification"];
    if (p95 >= ALERT_THRESHOLDS.latencyP95CritMs) {
      governanceClassification = "slowing";
    } else if (denyRate > 0.1) {
      governanceClassification = "protecting";
    } else {
      governanceClassification = "neutral";
    }

    return {
      latencyP50Ms: p50, latencyP95Ms: p95, latencyP99Ms: p99,
      conflictRate, denyRate, escalationRate,
      retryLoopCount, totalDecisions: total,
      governanceClassification,
    };
  }

  private checkAlerts(): void {
    const m = this.getMetrics();
    const now = new Date().toISOString();

    if (m.latencyP95Ms >= ALERT_THRESHOLDS.latencyP95CritMs) {
      this.emit({
        level: "critical", metric: "latency_p95_ms",
        value: m.latencyP95Ms, threshold: ALERT_THRESHOLDS.latencyP95CritMs,
        message: `Arbitration p95 latency ${m.latencyP95Ms}ms exceeds critical threshold of ${ALERT_THRESHOLDS.latencyP95CritMs}ms`,
        timestamp: now,
      });
    } else if (m.latencyP95Ms >= ALERT_THRESHOLDS.latencyP95WarnMs) {
      this.emit({
        level: "warning", metric: "latency_p95_ms",
        value: m.latencyP95Ms, threshold: ALERT_THRESHOLDS.latencyP95WarnMs,
        message: `Arbitration p95 latency ${m.latencyP95Ms}ms approaching critical threshold`,
        timestamp: now,
      });
    }

    if (this.baselineConflictRate !== null && this.baselineConflictRate > 0) {
      const increasePercent = ((m.conflictRate - this.baselineConflictRate) / this.baselineConflictRate) * 100;
      if (increasePercent >= ALERT_THRESHOLDS.conflictRateIncreasePercent) {
        this.emit({
          level: "warning", metric: "conflict_rate_increase_percent",
          value: increasePercent, threshold: ALERT_THRESHOLDS.conflictRateIncreasePercent,
          message: `Conflict rate ${increasePercent.toFixed(1)}% above baseline`,
          timestamp: now,
        });
      }
    }

    if (m.retryLoopCount >= ALERT_THRESHOLDS.retryLoopCritCount) {
      this.emit({
        level: "critical", metric: "retry_loop_count",
        value: m.retryLoopCount, threshold: ALERT_THRESHOLDS.retryLoopCritCount,
        message: `${m.retryLoopCount} decision retry loops detected — possible arbitration deadlock`,
        timestamp: now,
      });
    }
  }

  private emit(alert: GovernanceAlert): void {
    this.alertHandlers.forEach((h) => h(alert));
  }

  private pruneWindow(): void {
    const cutoff = Date.now() - this.windowMs;
    while (this.events.length > 0 && this.events[0].timestamp < cutoff) {
      this.events.shift();
    }
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

/** Singleton governance monitor. */
export const governanceMonitor = new GovernanceMonitor();
