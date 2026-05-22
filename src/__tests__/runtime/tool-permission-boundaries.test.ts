/**
 * Tool permission boundaries.
 *
 * AgentRunConfig.mcpTools acts as the agent's tool allow-list. This test
 * pins the boundary: when mcpTools is specified, the agent MUST NOT see
 * tools outside the list, even if the gateway exposes them.
 *
 * This is the principal defense against capability escalation in the runtime.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockClient, fakeTool, type MockClientHandle } from "./harness/mcpClientMock";

let mockHandle: MockClientHandle;
vi.mock("@/lib/mcp/client", () => ({
  McpClient: vi.fn().mockImplementation(() => mockHandle),
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
      mcpTools: ["safe_search"], // ONLY safe_search permitted
      maxSteps: 5,
    };

    const exec = new AutonomousAgentExecutor(config);
    await exec.execute();

    const calledNames = mockHandle.callLog.map((c) => c.name);
    expect(calledNames.length).toBeGreaterThan(0);
    for (const name of calledNames) {
      expect(["safe_search"]).toContain(name);
    }
    // Forbidden tools must never have been called.
    expect(calledNames).not.toContain("dangerous_shell_exec");
    expect(calledNames).not.toContain("filesystem_write");
    expect(calledNames).not.toContain("github_create_issue");
  });

  it("when allow-list is empty array, agent treats it as no tools permitted", async () => {
    // Defensive contract: mcpTools=[] currently means "filter to nothing".
    // If a future change interprets [] as "all tools", this test will fail
    // loudly — that change must be reviewed for security implications.
    const exec = new AutonomousAgentExecutor({
      agentId: "empty-list",
      name: "Empty",
      goal: "do anything",
      mcpGatewayUrl: "http://mock",
      mcpTools: [],
      maxSteps: 3,
    });
    const run = await exec.execute();

    expect(mockHandle.callLog.length).toBe(0);
    // With no tools available, the agent must terminate cleanly, not hang.
    expect(["completed", "failed"]).toContain(run.status);
  });

  it("when mcpTools is undefined, all gateway tools are accessible (documented default)", async () => {
    const exec = new AutonomousAgentExecutor({
      agentId: "open",
      name: "Open",
      goal: "find files",
      mcpGatewayUrl: "http://mock",
      maxSteps: 4,
    });
    await exec.execute();

    // Documenting the default: undefined allow-list = full gateway access.
    // Governance layer (Phase B follow-up) should remove this default.
    expect(mockHandle.listTools).toHaveBeenCalled();
  });
});
