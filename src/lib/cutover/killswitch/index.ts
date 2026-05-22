/**
 * Phase 0 — Global Safety Kill-Switch Layer
 *
 * All switches are environment-variable controlled, externally togglable
 * without a redeploy, and logged to the observability plane on every read.
 */

export type KillSwitchName =
  | "GLOBAL_EXECUTION_PAUSE"
  | "GOVERNANCE_ENFORCEMENT_LOCK"
  | "REPLAY_FREEZE_MODE"
  | "CANARY_ONLY_ROUTING_MODE";

export interface KillSwitchState {
  name: KillSwitchName;
  enabled: boolean;
  source: "env" | "runtime";
  toggledAt: string;
}

export type KillSwitchChangeListener = (state: KillSwitchState) => void;

/**
 * KillSwitchManager
 *
 * Reads switch state from environment variables and allows runtime overrides.
 * Every read is logged so the observability plane can track switch activations.
 */
export class KillSwitchManager {
  private readonly overrides = new Map<KillSwitchName, boolean>();
  private readonly listeners: KillSwitchChangeListener[] = [];

  /** Returns true if the given switch is currently active (blocking execution). */
  isActive(name: KillSwitchName): boolean {
    if (this.overrides.has(name)) {
      return this.overrides.get(name)!;
    }
    const envValue = process.env[name];
    const active = envValue === "true" || envValue === "1";
    this.log(name, active, "env");
    return active;
  }

  /**
   * Activate a kill-switch at runtime without a redeploy.
   * Triggers all registered listeners immediately.
   */
  activate(name: KillSwitchName): void {
    this.overrides.set(name, true);
    const state: KillSwitchState = {
      name,
      enabled: true,
      source: "runtime",
      toggledAt: new Date().toISOString(),
    };
    this.log(name, true, "runtime");
    this.listeners.forEach((l) => l(state));
  }

  /** Deactivate a kill-switch at runtime. */
  deactivate(name: KillSwitchName): void {
    this.overrides.set(name, false);
    const state: KillSwitchState = {
      name,
      enabled: false,
      source: "runtime",
      toggledAt: new Date().toISOString(),
    };
    this.log(name, false, "runtime");
    this.listeners.forEach((l) => l(state));
  }

  /** Register a listener that fires whenever any switch changes state. */
  onChange(listener: KillSwitchChangeListener): void {
    this.listeners.push(listener);
  }

  /** Snapshot of all switch states for the observability plane. */
  snapshot(): KillSwitchState[] {
    const names: KillSwitchName[] = [
      "GLOBAL_EXECUTION_PAUSE",
      "GOVERNANCE_ENFORCEMENT_LOCK",
      "REPLAY_FREEZE_MODE",
      "CANARY_ONLY_ROUTING_MODE",
    ];
    return names.map((name) => ({
      name,
      enabled: this.isActive(name),
      source: this.overrides.has(name) ? "runtime" : "env",
      toggledAt: new Date().toISOString(),
    }));
  }

  private log(name: KillSwitchName, active: boolean, source: "env" | "runtime"): void {
    // In production this would emit to the observability collector via OTLP
    console.log(
      JSON.stringify({
        event: "kill_switch_read",
        name,
        active,
        source,
        ts: new Date().toISOString(),
      })
    );
  }
}

/** Singleton instance for use across the runtime. */
export const killSwitches = new KillSwitchManager();

/**
 * Guard function: throws if the given kill-switch is active.
 * Use at the entry point of every execution path.
 */
export function assertNotPaused(name: KillSwitchName): void {
  if (killSwitches.isActive(name)) {
    throw new KillSwitchError(name);
  }
}

export class KillSwitchError extends Error {
  readonly switchName: KillSwitchName;
  constructor(name: KillSwitchName) {
    super(`Execution blocked: kill-switch '${name}' is active`);
    this.name = "KillSwitchError";
    this.switchName = name;
  }
}
