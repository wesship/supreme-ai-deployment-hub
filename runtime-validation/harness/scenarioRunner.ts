/**
 * runtime-validation/harness/scenarioRunner.ts
 *
 * Scenario Runner for the D3VONN.IO Runtime Validation Harness.
 *
 * A scenario is a named, self-contained test that:
 *   1. Receives a fresh TraceEngine instance
 *   2. Executes a sequence of operations against mocked runtimes
 *   3. Returns a set of assertions against the captured trace
 *
 * The runner collects results, builds the DAG, and returns a ScenarioResult
 * that can be serialised to reports/ for audit purposes.
 */

import { TraceEngine, resetIdSequence } from "./traceEngine";
import type { ScenarioResult, ScenarioAssertion, ExecutionDAG } from "./types";

// ---------------------------------------------------------------------------
// Scenario definition
// ---------------------------------------------------------------------------

export interface ScenarioContext {
  trace: TraceEngine;
  /** Convenience: assert a condition and record it */
  assert(description: string, condition: boolean, detail?: string): void;
}

export type ScenarioFn = (ctx: ScenarioContext) => Promise<void> | void;

export interface ScenarioDefinition {
  id: string;
  description: string;
  fn: ScenarioFn;
}

// ---------------------------------------------------------------------------
// ScenarioRunner
// ---------------------------------------------------------------------------

export class ScenarioRunner {
  private scenarios: ScenarioDefinition[] = [];

  /** Register a scenario */
  register(scenario: ScenarioDefinition): this {
    this.scenarios.push(scenario);
    return this;
  }

  /** Run all registered scenarios and return results */
  async runAll(): Promise<ScenarioResult[]> {
    const results: ScenarioResult[] = [];
    for (const scenario of this.scenarios) {
      results.push(await this.runOne(scenario));
    }
    return results;
  }

  /** Run a single scenario by ID */
  async runById(id: string): Promise<ScenarioResult | null> {
    const scenario = this.scenarios.find((s) => s.id === id);
    if (!scenario) return null;
    return this.runOne(scenario);
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private async runOne(scenario: ScenarioDefinition): Promise<ScenarioResult> {
    resetIdSequence();
    const trace = new TraceEngine(scenario.id);
    const assertions: ScenarioAssertion[] = [];

    const ctx: ScenarioContext = {
      trace,
      assert(description: string, condition: boolean, detail?: string) {
        assertions.push({ description, passed: condition, detail });
      },
    };

    let error: string | undefined;
    let dag: ExecutionDAG;

    try {
      await scenario.fn(ctx);
      dag = trace.buildDAG();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      // Build whatever DAG we have so far
      dag = trace.buildDAG();
    }

    const allPassed = assertions.every((a) => a.passed) && !error;

    return {
      scenarioId: scenario.id,
      status: error ? "failed" : allPassed ? "passed" : "failed",
      dag,
      assertions,
      error,
      completedAt: new Date().toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// Convenience factory
// ---------------------------------------------------------------------------

/** Create a runner pre-loaded with a single scenario — useful in vitest */
export function createScenario(def: ScenarioDefinition): ScenarioRunner {
  return new ScenarioRunner().register(def);
}
