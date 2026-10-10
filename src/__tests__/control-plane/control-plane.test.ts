/**
 * Canary Activation Control Plane — Integration Tests
 *
 * Tests the ControlPlaneController, ClusterCanaryRouter, and
 * ClusterBlastRadiusEnforcer using a MockK8sClient.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ControlPlaneController,
  EnvConfigMapClient,
  type K8sConfigMapClient,
} from "../../lib/control-plane/controlPlaneController.js";
import { ClusterCanaryRouter } from "../../lib/control-plane/clusterCanaryRouter.js";
import { ClusterBlastRadiusEnforcer } from "../../lib/control-plane/clusterBlastRadiusEnforcer.js";

// ── Mock K8s Client ───────────────────────────────────────────────────────────

class MockK8sClient implements K8sConfigMapClient {
  private store: Record<string, string> = {
    CANARY_ENABLED: "false",
    CANARY_PERCENTAGE: "0",
    CANARY_STAGE: "C0",
    GLOBAL_EXECUTION_PAUSE: "false",
    GOVERNANCE_ENFORCEMENT_LOCK: "false",
    REPLAY_FREEZE_MODE: "false",
    KILL_SWITCH_GLOBAL: "armed",
    BLAST_RADIUS_MODE: "strict",
    BLAST_RADIUS_MAX_AGENTS_PER_TENANT: "5",
    BLAST_RADIUS_MAX_MEMORY_NAMESPACES: "10",
    BLAST_RADIUS_OBS_RATE_LIMIT: "1000",
    GOVERNANCE_MODE: "enforcing",
    GOVERNANCE_LATENCY_WARN_MS: "150",
    GOVERNANCE_LATENCY_CRIT_MS: "200",
    REPLAY_MODE: "active",
    MEMORY_WRITE_MODE: "strict",
    FAILURE_CONTAINMENT: "enabled",
    AUTO_ROLLBACK: "armed",
    TRACE_INTAKE_RATE_LIMIT: "10000",
  };

  async getConfigMap(_name: string, _namespace: string): Promise<Record<string, string>> {
    return { ...this.store };
  }

  async patchConfigMap(_name: string, _namespace: string, data: Record<string, string>): Promise<void> {
    Object.assign(this.store, data);
  }

  set(key: string, value: string): void {
    this.store[key] = value;
  }
}

// ── ControlPlaneController Tests ─────────────────────────────────────────────

describe("ControlPlaneController", () => {
  let client: MockK8sClient;
  let controller: ControlPlaneController;

  beforeEach(() => {
    client = new MockK8sClient();
    controller = new ControlPlaneController(client);
  });

  it("reads default config correctly", async () => {
    const config = await controller.getConfig();
    expect(config.canaryEnabled).toBe(false);
    expect(config.canaryStage).toBe("C0");
    expect(config.canaryPercentage).toBe(0);
    expect(config.globalExecutionPause).toBe(false);
    expect(config.governanceMode).toBe("enforcing");
    expect(config.blastRadiusMode).toBe("strict");
  });

  it("activateC1 transitions from C0 to C1 at 0.5%", async () => {
    await controller.activateC1();
    const config = await controller.getConfig();
    expect(config.canaryEnabled).toBe(true);
    expect(config.canaryStage).toBe("C1");
    expect(config.canaryPercentage).toBe(0.5);
  });

  it("activateC1 throws if current stage is not C0", async () => {
    client.set("CANARY_STAGE", "C1");
    await expect(controller.activateC1()).rejects.toThrow("Cannot activate C1");
  });

  it("emergencyStop sets GLOBAL_EXECUTION_PAUSE and disables canary", async () => {
    client.set("CANARY_ENABLED", "true");
    client.set("CANARY_STAGE", "C1");
    await controller.emergencyStop();
    const config = await controller.getConfig();
    expect(config.globalExecutionPause).toBe(true);
    expect(config.canaryEnabled).toBe(false);
    expect(config.killSwitchGlobal).toBe("triggered");
  });

  it("clearEmergencyStop restores normal operation", async () => {
    await controller.emergencyStop();
    await controller.clearEmergencyStop();
    const config = await controller.getConfig();
    expect(config.globalExecutionPause).toBe(false);
    expect(config.killSwitchGlobal).toBe("armed");
  });

  it("isGovernanceEnforcing returns true when GOVERNANCE_MODE=enforcing", async () => {
    expect(await controller.isGovernanceEnforcing()).toBe(true);
  });

  it("isGovernanceEnforcing returns false when GOVERNANCE_MODE=permissive", async () => {
    client.set("GOVERNANCE_MODE", "permissive");
    expect(await controller.isGovernanceEnforcing()).toBe(false);
  });
});

// ── ClusterCanaryRouter Tests ─────────────────────────────────────────────────

describe("ClusterCanaryRouter", () => {
  let client: MockK8sClient;
  let controller: ControlPlaneController;
  let router: ClusterCanaryRouter;

  beforeEach(() => {
    client = new MockK8sClient();
    controller = new ControlPlaneController(client);
    router = new ClusterCanaryRouter(controller);
  });

  it("routes to stable when canary is disabled (C0)", async () => {
    const decision = await router.shouldRouteToCanary("tenant-abc");
    expect(decision.routeToCanary).toBe(false);
    expect(decision.reason).toContain("C0");
  });

  it("routes to stable when GLOBAL_EXECUTION_PAUSE is true", async () => {
    client.set("CANARY_ENABLED", "true");
    client.set("CANARY_STAGE", "C1");
    client.set("CANARY_PERCENTAGE", "100");
    client.set("GLOBAL_EXECUTION_PAUSE", "true");
    const decision = await router.shouldRouteToCanary("tenant-abc");
    expect(decision.routeToCanary).toBe(false);
    expect(decision.reason).toContain("GLOBAL_EXECUTION_PAUSE");
  });

  it("produces deterministic routing for the same tenant", async () => {
    client.set("CANARY_ENABLED", "true");
    client.set("CANARY_STAGE", "C1");
    client.set("CANARY_PERCENTAGE", "50");
    const results = await Promise.all(
      Array.from({ length: 10 }, () => router.shouldRouteToCanary("tenant-deterministic"))
    );
    const allSame = results.every((r) => r.routeToCanary === results[0].routeToCanary);
    expect(allSame).toBe(true);
  });

  it("routes approximately 0.5% of tenants to canary at C1", async () => {
    client.set("CANARY_ENABLED", "true");
    client.set("CANARY_STAGE", "C1");
    client.set("CANARY_PERCENTAGE", "0.5");
    const decisions = await Promise.all(
      Array.from({ length: 10_000 }, (_, i) => router.shouldRouteToCanary(`tenant-${i}`))
    );
    const canaryCount = decisions.filter((d) => d.routeToCanary).length;
    // Expect roughly 50 ± 100 out of 10,000 (0.5% with natural hash variance)
    expect(canaryCount).toBeGreaterThan(5);
    expect(canaryCount).toBeLessThan(150);
  });

  it("routes 100% of tenants to canary when percentage is 100", async () => {
    client.set("CANARY_ENABLED", "true");
    client.set("CANARY_STAGE", "C4");
    client.set("CANARY_PERCENTAGE", "100");
    const decisions = await Promise.all(
      Array.from({ length: 100 }, (_, i) => router.shouldRouteToCanary(`tenant-${i}`))
    );
    expect(decisions.every((d) => d.routeToCanary)).toBe(true);
  });
});

// ── ClusterBlastRadiusEnforcer Tests ─────────────────────────────────────────

describe("ClusterBlastRadiusEnforcer", () => {
  let client: MockK8sClient;
  let controller: ControlPlaneController;
  let enforcer: ClusterBlastRadiusEnforcer;

  beforeEach(() => {
    client = new MockK8sClient();
    controller = new ControlPlaneController(client);
    enforcer = new ClusterBlastRadiusEnforcer(controller);
  });

  it("allows execution when within limits", async () => {
    const result = await enforcer.enforce({
      tenantId: "t1",
      activeAgentsForTenant: 3,
      systemLoadPercent: 50,
    });
    expect(result.allowed).toBe(true);
  });

  it("denies execution in strict mode when agent limit is reached", async () => {
    const result = await enforcer.enforce({
      tenantId: "t1",
      activeAgentsForTenant: 5, // equals max of 5
      systemLoadPercent: 50,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("limit is 5");
  });

  it("denies execution in strict mode when system load exceeds 90%", async () => {
    const result = await enforcer.enforce({
      tenantId: "t1",
      activeAgentsForTenant: 1,
      systemLoadPercent: 95,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("90%");
  });

  it("allows execution in permissive mode even when limits are exceeded", async () => {
    client.set("BLAST_RADIUS_MODE", "permissive");
    const result = await enforcer.enforce({
      tenantId: "t1",
      activeAgentsForTenant: 100,
      systemLoadPercent: 99,
    });
    expect(result.allowed).toBe(true);
    expect(result.mode).toBe("permissive");
  });
});

// ── End-to-End: Emergency Stop Flow ──────────────────────────────────────────

describe("End-to-End: Emergency Stop and Restore Flow", () => {
  it("emergency stop prevents canary routing and blocks new executions", async () => {
    const client = new MockK8sClient();
    const controller = new ControlPlaneController(client);
    const router = new ClusterCanaryRouter(controller);
    const enforcer = new ClusterBlastRadiusEnforcer(controller);

    // Activate C1
    await controller.activateC1();
    expect((await controller.getConfig()).canaryEnabled).toBe(true);

    // Emergency stop
    await controller.emergencyStop();

    // Canary router should route to stable
    const routingDecision = await router.shouldRouteToCanary("tenant-x");
    expect(routingDecision.routeToCanary).toBe(false);
    expect(routingDecision.reason).toContain("GLOBAL_EXECUTION_PAUSE");

    // Restore
    await controller.clearEmergencyStop();
    expect((await controller.getConfig()).globalExecutionPause).toBe(false);
  });
});
