/**
 * Tool permission boundaries.
 *
 * AgentRunConfig.mcpTools acts as the agent's tool allow-list. This test
 * pins the boundary: when mcpTools is specified, the agent MUST NOT see
 * tools outside the list, even if the gateway exposes them.
 *
 * The runtime is fail-closed by default. Full gateway access requires the
 * separate allowAllMcpTools opt-in.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockClient, fakeTool, type MockClientHandle } from "./harness/mcpClientMock";

let mockHandle: MockClientHandle;
vi.mock("@/lib/mcp/client", () => ({
  McpClient: class {
    initialize = (...a: any[]) => (mockHandle.initialize as any)(...a);
    listTools  = (...a: any[]) => (mockHandle.listTools as any)(...a);
    callTool   = (...a: any[]) => (mockHandle.callTool as any)(...a);
    close      = (...a: any[]) => (mockHandle.close as any)(...a);
  },
}));

import { AutonomousAgentExecutor } from "@/lib/mcp/autonomousAgent";
import type { AgentRunConfig } from "@/lib/mcp/agentTypes";

describe("Tool permission boundaries (capability allow-list)", () => {
  beforeEach(() => {
    mockHandle = createMockClient({
      tools: [
        fakeTool("safe_search"),
        fakeTool("dangerous_shell_exec"),
        fakeTool("filesystem_write"),
        fakeTool("github_create_issue"),
      ],
    });
  });

  it("only invokes tools present in the mcpTools allow-list", async () => {
    const config: AgentRunConfig = {
      agentId: "scoped-agent",
      name: "Scoped",
      goal: "search for something",
      mcpGatewayUrl: "http://mock",
      mcpTools: ["safe_search"],
      maxSteps: 5,
    };

    const exec = new AutonomousAgentExecutor(config);
    await exec.execute();

    const calledNames = mockHandle.callLog.map((c) => c.name);
    expect(calledNames.length).toBeGreaterThan(0);
    for (const name of calledNames) {
      expect(["safe_search"]).toContain(name);
    }
    expect(calledNames).not.toContain("dangerous_shell_exec");
    expect(calledNames).not.toContain("filesystem_write");
    expect(calledNames).not.toContain("github_create_issue");
  });

  it("treats an empty mcpTools allow-list as deny-all", async () => {
    const exec = new AutonomousAgentExecutor({
      agentId: "empty-list",
      name: "Empty",
      goal: "do anything",
      mcpGatewayUrl: "http://mock",
      mcpTools: [],
      maxSteps: 3,
    });

    await exec.execute();
    expect(mockHandle.callLog.length).toBe(0);
  });

  it("fails closed when mcpTools is undefined", async () => {
    const exec = new AutonomousAgentExecutor({
      agentId: "default-deny",
      name: "Default deny",
      goal: "find files",
      mcpGatewayUrl: "http://mock",
      maxSteps: 4,
    });

    await exec.execute();
    expect(mockHandle.listTools).toHaveBeenCalled();
    expect(mockHandle.callLog.length).toBe(0);
  });

  it("allows full gateway access only with explicit allowAllMcpTools opt-in", async () => {
    const exec = new AutonomousAgentExecutor({
      agentId: "explicit-open",
      name: "Explicit open",
      goal: "do anything",
      mcpGatewayUrl: "http://mock",
      allowAllMcpTools: true,
      maxSteps: 3,
    });

    await exec.execute();
    expect(mockHandle.callLog.length).toBeGreaterThan(0);
  });

  it("keeps an explicit allow-list authoritative over allowAllMcpTools", async () => {
    const exec = new AutonomousAgentExecutor({
      agentId: "conflicting-config",
      name: "Conflicting config",
      goal: "search for something",
      mcpGatewayUrl: "http://mock",
      mcpTools: ["safe_search"],
      allowAllMcpTools: true,
      maxSteps: 5,
    });

    await exec.execute();
    const calledNames = mockHandle.callLog.map((c) => c.name);
    expect(calledNames.length).toBeGreaterThan(0);
    expect(calledNames.every((name) => name === "safe_search")).toBe(true);
  });
});
