/**
 * Canary Activation Control Plane — ControlPlaneController
 *
 * The single brain that reads from the Kubernetes ConfigMap
 * (d3vonn-runtime-control-plane) and exposes typed accessors for
 * every runtime switch. Supports both cluster-mode (reads from K8s API)
 * and env-mode (reads from process.env) for local development.
 */

export type GovernanceMode = "enforcing" | "permissive" | "disabled";
export type BlastRadiusMode = "strict" | "permissive";
export type CanaryStage = "C0" | "C1" | "C2" | "C3" | "C4";
export type KillSwitchGlobalState = "armed" | "triggered";

export interface ControlPlaneConfig {
  // Canary
  canaryEnabled: boolean;
  canaryPercentage: number;
  canaryStage: CanaryStage;
  // Kill switches
  globalExecutionPause: boolean;
  governanceEnforcementLock: boolean;
  replayFreezeMode: boolean;
  killSwitchGlobal: KillSwitchGlobalState;
  // Blast radius
  blastRadiusMode: BlastRadiusMode;
  blastRadiusMaxAgentsPerTenant: number;
  blastRadiusMaxMemoryNamespaces: number;
  blastRadiusObsRateLimit: number;
  // Governance
  governanceMode: GovernanceMode;
  governanceLatencyWarnMs: number;
  governanceLatencyCritMs: number;
  // Replay / memory
  replayMode: string;
  memoryWriteMode: string;
  // Failure containment
  failureContainment: string;
  autoRollback: string;
  // Observability
  traceIntakeRateLimit: number;
}

/**
 * Interface for the K8s client adapter.
 * In production, inject a real @kubernetes/client-node CoreV1Api wrapper.
 * In tests, inject a MockK8sClient.
 */
export interface K8sConfigMapClient {
  getConfigMap(name: string, namespace: string): Promise<Record<string, string>>;
  patchConfigMap(name: string, namespace: string, data: Record<string, string>): Promise<void>;
}

/** Reads config from process.env — used in local dev and CI. */
export class EnvConfigMapClient implements K8sConfigMapClient {
  async getConfigMap(_name: string, _namespace: string): Promise<Record<string, string>> {
    return { ...process.env } as Record<string, string>;
  }

  async patchConfigMap(_name: string, _namespace: string, data: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(data)) {
      process.env[key] = value;
    }
  }
}

const CONFIG_MAP_NAME = "d3vonn-runtime-control-plane";
const CONFIG_MAP_NAMESPACE = "d3vonn-prod";

export class ControlPlaneController {
  constructor(private readonly k8s: K8sConfigMapClient) {}

  /** Fetch and parse the full control plane config. */
  async getConfig(): Promise<ControlPlaneConfig> {
    const data = await this.k8s.getConfigMap(CONFIG_MAP_NAME, CONFIG_MAP_NAMESPACE);
    return {
      canaryEnabled: data["CANARY_ENABLED"] === "true",
      canaryPercentage: parseFloat(data["CANARY_PERCENTAGE"] ?? "0"),
      canaryStage: (data["CANARY_STAGE"] as CanaryStage) ?? "C0",
      globalExecutionPause: data["GLOBAL_EXECUTION_PAUSE"] === "true",
      governanceEnforcementLock: data["GOVERNANCE_ENFORCEMENT_LOCK"] === "true",
      replayFreezeMode: data["REPLAY_FREEZE_MODE"] === "true",
      killSwitchGlobal: (data["KILL_SWITCH_GLOBAL"] as KillSwitchGlobalState) ?? "armed",
      blastRadiusMode: (data["BLAST_RADIUS_MODE"] as BlastRadiusMode) ?? "strict",
      blastRadiusMaxAgentsPerTenant: parseInt(data["BLAST_RADIUS_MAX_AGENTS_PER_TENANT"] ?? "5"),
      blastRadiusMaxMemoryNamespaces: parseInt(data["BLAST_RADIUS_MAX_MEMORY_NAMESPACES"] ?? "10"),
      blastRadiusObsRateLimit: parseInt(data["BLAST_RADIUS_OBS_RATE_LIMIT"] ?? "1000"),
      governanceMode: (data["GOVERNANCE_MODE"] as GovernanceMode) ?? "enforcing",
      governanceLatencyWarnMs: parseInt(data["GOVERNANCE_LATENCY_WARN_MS"] ?? "150"),
      governanceLatencyCritMs: parseInt(data["GOVERNANCE_LATENCY_CRIT_MS"] ?? "200"),
      replayMode: data["REPLAY_MODE"] ?? "active",
      memoryWriteMode: data["MEMORY_WRITE_MODE"] ?? "strict",
      failureContainment: data["FAILURE_CONTAINMENT"] ?? "enabled",
      autoRollback: data["AUTO_ROLLBACK"] ?? "armed",
      traceIntakeRateLimit: parseInt(data["TRACE_INTAKE_RATE_LIMIT"] ?? "10000"),
    };
  }

  async isCanaryEnabled(): Promise<boolean> {
    return (await this.getConfig()).canaryEnabled;
  }

  async canaryPercentage(): Promise<number> {
    return (await this.getConfig()).canaryPercentage;
  }

  async isGlobalExecutionPaused(): Promise<boolean> {
    return (await this.getConfig()).globalExecutionPause;
  }

  async isGovernanceEnforcing(): Promise<boolean> {
    return (await this.getConfig()).governanceMode === "enforcing";
  }

  async isKillSwitchTriggered(): Promise<boolean> {
    return (await this.getConfig()).killSwitchGlobal === "triggered";
  }

  /**
   * Activate C1 canary: sets CANARY_ENABLED=true, CANARY_PERCENTAGE=0.5, CANARY_STAGE=C1.
   * This is the only safe way to advance from C0.
   */
  async activateC1(): Promise<void> {
    const config = await this.getConfig();
    if (config.canaryStage !== "C0") {
      throw new Error(`Cannot activate C1: current stage is ${config.canaryStage}. Must be C0.`);
    }
    await this.k8s.patchConfigMap(CONFIG_MAP_NAME, CONFIG_MAP_NAMESPACE, {
      CANARY_ENABLED: "true",
      CANARY_PERCENTAGE: "0.5",
      CANARY_STAGE: "C1",
    });
  }

  /**
   * Emergency stop: pauses all execution and disables canary routing.
   * Does NOT require a pod restart — takes effect on next request.
   */
  async emergencyStop(): Promise<void> {
    await this.k8s.patchConfigMap(CONFIG_MAP_NAME, CONFIG_MAP_NAMESPACE, {
      GLOBAL_EXECUTION_PAUSE: "true",
      CANARY_ENABLED: "false",
      KILL_SWITCH_GLOBAL: "triggered",
    });
  }

  /** Restore normal operation after an emergency stop. */
  async clearEmergencyStop(): Promise<void> {
    await this.k8s.patchConfigMap(CONFIG_MAP_NAME, CONFIG_MAP_NAMESPACE, {
      GLOBAL_EXECUTION_PAUSE: "false",
      KILL_SWITCH_GLOBAL: "armed",
    });
  }
}
