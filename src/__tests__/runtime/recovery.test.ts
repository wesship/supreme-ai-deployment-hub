/**
 * Recovery: the agent must survive transient tool failures without crashing
 * the run. A tool error becomes an "observation" step the agent reasons over,
 * never a thrown exception that bubbles out of execute().
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

describe("Agent recovery from tool failures", () => {
  beforeEach(() => {
    mockHandle = createMockClient({
      tools: [fakeTool("flaky_tool")],
      toolBehavior: {
        flaky_tool: () => {
          throw new Error("simulated network blip");
        },
      },
    });
  });

  it("catches thrown tool errors and continues the run (no exception escapes)", async () => {
    const exec = new AutonomousAgentExecutor({
      agentId: "resilient",
      name: "Resilient",
      goal: "use flaky_tool",
      mcpGatewayUrl: "http://mock",
      maxSteps: 4,
      allowAllMcpTools: true,
    });

    const run = await exec.execute();

    expect(["completed", "failed"]).toContain(run.status);
    const errorSteps = run.steps.filter((s) =>
      s.type === "tool_result" && s.content.includes("Error")
    );
    expect(errorSteps.length).toBeGreaterThan(0);
    expect(errorSteps[0].content).toMatch(/simulated network blip/);
  });

  it("records isError=true tool results as failure observations", async () => {
    mockHandle = createMockClient({
      tools: [fakeTool("erroring_tool")],
      toolBehavior: {
        erroring_tool: () => ({
          content: [{ type: "text", text: "rate limited" }],
          isError: true,
        }),
      },
    });

    const exec = new AutonomousAgentExecutor({
      agentId: "obs",
      name: "Obs",
      goal: "use erroring_tool",
      mcpGatewayUrl: "http://mock",
      maxSteps: 4,
      allowAllMcpTools: true,
    });
    const run = await exec.execute();

    const observation = run.steps.find(
      (s) => s.type === "observation" && /different approach/i.test(s.content)
    );
    expect(observation).toBeDefined();
  });
});
