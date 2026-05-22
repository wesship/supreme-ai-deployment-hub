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
  // Class-based mock proxies to the current `mockHandle` lazily so per-test
  // reassignment in beforeEach is picked up. Cannot use arrow in mockImplementation
  // because `new ArrowFn()` throws "is not a constructor".
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

  // RUNTIME FINDING (Phase B): the current executor treats `mcpTools: []` as
  // "no allow-list configured" (because `[].length` is falsy) and falls back
  // to ALL gateway tools. That's a capability-escalation gap — an empty list
  // should mean "no tools permitted", not "all tools permitted".
  //
  // `it.fails` pins the current insecure behavior: this test PASSES so long
  // as the bug exists; the moment someone fixes the executor to treat empty
  // arrays as deny-all, this test will start failing and demand removal of
  // the `.fails` marker — at which point the security gap is closed.
  it.fails(
    "REGRESSION FENCE: empty mcpTools is currently treated as open (Phase B finding)",
    async () => {
      const exec = new AutonomousAgentExecutor({
        agentId: "empty-list",
        name: "Empty",
        goal: "do anything",
        mcpGatewayUrl: "http://mock",
        mcpTools: [],
        maxSteps: 3,
      });
      await exec.execute();
      // DESIRED behavior (after fix): zero tool calls.
      expect(mockHandle.callLog.length).toBe(0);
    }
  );

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
