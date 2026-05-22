/**
 * Phase 3 — Failure Containment: Circuit Breakers and Automatic Containment Actions
 *
 * Three-tier circuit breaker hierarchy:
 *   1. Execution-level: per-run failure isolation
 *   2. Tenant-level: per-tenant error rate tracking
 *   3. Global: emergency shutdown across all tenants
 *
 * When a breaker trips, automatic containment actions are triggered:
 *   - Stop agent spawning
 *   - Freeze memory writes
 *   - Pause replay ingestion
 *   - Isolate failing tenant
 */

export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerConfig {
  /** Number of failures before the circuit opens. */
  failureThreshold: number;
  /** Duration in ms to keep the circuit open before attempting half-open. */
  resetTimeoutMs: number;
  /** Number of successful calls in half-open state before closing. */
  halfOpenSuccessThreshold: number;
}

export interface ContainmentAction {
  type: "stop_agent_spawning" | "freeze_memory_writes" | "pause_replay_ingestion" | "isolate_tenant";
  scope: "execution" | "tenant" | "global";
  targetId?: string;
  timestamp: string;
}

export type ContainmentActionHandler = (action: ContainmentAction) => void;

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenSuccessThreshold: 2,
};

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount = 0;
  private successCount = 0;
  private openedAt: number | null = null;
  private readonly config: CircuitBreakerConfig;

  constructor(
    readonly name: string,
    config: Partial<CircuitBreakerConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  getState(): CircuitState {
    return this.state;
  }

  /**
   * Attempt to execute a function through the circuit breaker.
   * Throws CircuitOpenError if the circuit is open.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      // Check if reset timeout has elapsed to transition to half-open
      if (this.openedAt !== null && Date.now() - this.openedAt >= this.config.resetTimeoutMs) {
        this.state = "half-open";
        this.successCount = 0;
      } else {
        throw new CircuitOpenError(this.name);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  recordSuccess(): void {
    this.onSuccess();
  }

  recordFailure(): void {
    this.onFailure();
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === "half-open") {
      this.successCount++;
      if (this.successCount >= this.config.halfOpenSuccessThreshold) {
        this.state = "closed";
        this.openedAt = null;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    if (this.state === "half-open" || this.failureCount >= this.config.failureThreshold) {
      this.state = "open";
      this.openedAt = Date.now();
    }
  }
}

export class CircuitOpenError extends Error {
  constructor(readonly breakerName: string) {
    super(`Circuit breaker '${breakerName}' is open — execution blocked`);
    this.name = "CircuitOpenError";
  }
}

/**
 * FailureContainmentController
 *
 * Manages the three-tier circuit breaker hierarchy and
 * dispatches automatic containment actions when breakers trip.
 */
export class FailureContainmentController {
  private readonly globalBreaker: CircuitBreaker;
  private readonly tenantBreakers = new Map<string, CircuitBreaker>();
  private readonly executionBreakers = new Map<string, CircuitBreaker>();
  private readonly actionHandlers: ContainmentActionHandler[] = [];

  constructor() {
    this.globalBreaker = new CircuitBreaker("global", {
      failureThreshold: 20,
      resetTimeoutMs: 60_000,
      halfOpenSuccessThreshold: 5,
    });
  }

  /** Register a handler for automatic containment actions. */
  onContainmentAction(handler: ContainmentActionHandler): void {
    this.actionHandlers.push(handler);
  }

  /** Get or create a tenant-level circuit breaker. */
  getTenantBreaker(tenantId: string): CircuitBreaker {
    if (!this.tenantBreakers.has(tenantId)) {
      this.tenantBreakers.set(
        tenantId,
        new CircuitBreaker(`tenant:${tenantId}`, {
          failureThreshold: 10,
          resetTimeoutMs: 45_000,
          halfOpenSuccessThreshold: 3,
        })
      );
    }
    return this.tenantBreakers.get(tenantId)!;
  }

  /** Get or create an execution-level circuit breaker. */
  getExecutionBreaker(executionId: string): CircuitBreaker {
    if (!this.executionBreakers.has(executionId)) {
      this.executionBreakers.set(
        executionId,
        new CircuitBreaker(`execution:${executionId}`, {
          failureThreshold: 3,
          resetTimeoutMs: 15_000,
          halfOpenSuccessThreshold: 1,
        })
      );
    }
    return this.executionBreakers.get(executionId)!;
  }

  /**
   * Record a failure at all three levels simultaneously.
   * Triggers containment actions if any breaker trips.
   */
  recordFailure(executionId: string, tenantId: string): void {
    const execBreaker = this.getExecutionBreaker(executionId);
    const tenantBreaker = this.getTenantBreaker(tenantId);

    const execWasOpen = execBreaker.getState() === "open";
    execBreaker.recordFailure();
    tenantBreaker.recordFailure();
    this.globalBreaker.recordFailure();

    if (!execWasOpen && execBreaker.getState() === "open") {
      this.dispatchContainmentActions("execution", executionId);
    }
    if (tenantBreaker.getState() === "open") {
      this.dispatchContainmentActions("tenant", tenantId);
    }
    if (this.globalBreaker.getState() === "open") {
      this.dispatchContainmentActions("global");
    }
  }

  /** Trigger the global emergency shutdown. */
  triggerEmergencyShutdown(): void {
    this.dispatchContainmentActions("global");
  }

  private dispatchContainmentActions(
    scope: "execution" | "tenant" | "global",
    targetId?: string
  ): void {
    const now = new Date().toISOString();
    const actions: ContainmentAction[] = [
      { type: "stop_agent_spawning", scope, targetId, timestamp: now },
      { type: "freeze_memory_writes", scope, targetId, timestamp: now },
      { type: "pause_replay_ingestion", scope, targetId, timestamp: now },
    ];
    if (scope === "tenant" && targetId) {
      actions.push({ type: "isolate_tenant", scope, targetId, timestamp: now });
    }
    actions.forEach((action) => {
      this.actionHandlers.forEach((h) => h(action));
    });
  }
}

/** Singleton failure containment controller. */
export const failureContainment = new FailureContainmentController();
