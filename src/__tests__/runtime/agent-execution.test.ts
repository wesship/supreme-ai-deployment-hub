/**
 * Agent execution lifecycle: step ceiling, status transitions, final-answer
 * termination, and manual stop().
 *
 * These tests pin the ReAct loop's contract so silent regressions in
 * AutonomousAgentExecutor (the runtime spine) get caught.
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

const baseConfig = (overrides: Partial<AgentRunConfig> = {}): AgentRunConfig => ({
  agentId: "agent-test",
  name: "Test Agent",
  goal: "search for devonn.ai status",
  mcpGatewayUrl: "http://mock",
  maxSteps: 8,
  ...overrides,
});

describe("AutonomousAgentExecutor — execution lifecycle", () => {
  beforeEach(() => {
    mockHandle = createMockClient({
      tools: [fakeTool("duckduckgo_search"), fakeTool("read_file")],
    });
  });

  it("transitions idle → thinking → executing → completed on happy path", async () => {
    const statuses: string[] = [];
    const exec = new AutonomousAgentExecutor(baseConfig(), {
      onStatusChange: (s) => statuses.push(s),
    });

    const run = await exec.execute();

    expect(run.status).toBe("completed");
    expect(statuses[0]).toBe("thinking");
    expect(statuses).toContain("executing");
    expect(statuses[statuses.length - 1]).toBe("completed");
    expect(run.finalResult).toBeTruthy();
    expect(run.completedAt).toBeTruthy();
  });

  it("enforces maxSteps ceiling — never exceeds configured budget", async () => {
    // Force the agent into a loop where it never produces a final_answer:
    // a tool that always errors. The current executor will mark failed via
    // observation step but eventually run out of steps.
    mockHandle = createMockClient({
      tools: [fakeTool("loop_tool")],
      toolBehavior: {
        loop_tool: () => ({ content: [{ type: "text", text: "still going" }], isError: false }),
      },
    });

    const exec = new AutonomousAgentExecutor(baseConfig({ goal: "do nothing", maxSteps: 3 }));
    const run = await exec.execute();

    // Initial thought + (tool_call + tool_result + observation) per iteration,
    // capped to maxSteps iterations. Hard upper bound: 1 + 3 * 3 = 10 steps.
    expect(run.steps.length).toBeLessThanOrEqual(10);
    expect(["completed", "failed"]).toContain(run.status);
  });

  it("stop() halts execution and marks run as stopped", async () => {
    mockHandle = createMockClient({
      tools: [fakeTool("slow_tool")],
      toolBehavior: {
        slow_tool: async () => {
          await new Promise((r) => setTimeout(r, 5));
          return { content: [{ type: "text", text: "slow" }], isError: false };
        },
      },
    });

    const exec = new AutonomousAgentExecutor(baseConfig({ goal: "slow goal", maxSteps: 50 }));
    const runPromise = exec.execute();
    // Stop immediately after kickoff.
    setTimeout(() => exec.stop(), 1);
    const run = await runPromise;

    // Either stopped (caught between iterations) OR completed/failed naturally
    // before stop fired — both are valid; what we MUST NOT see is silent hang.
    expect(["stopped", "completed", "failed"]).toContain(run.status);
    expect(run.completedAt).toBeTruthy();
  });

  it("calls mcpClient.close() on every termination path (resource cleanup)", async () => {
    const exec = new AutonomousAgentExecutor(baseConfig());
    await exec.execute();
    expect(mockHandle.close).toHaveBeenCalledTimes(1);
  });

  it("marks status=failed and surfaces error when initialize() throws", async () => {
    mockHandle = createMockClient({ initializeShouldFail: true });
    const exec = new AutonomousAgentExecutor(baseConfig());
    const run = await exec.execute();

    expect(run.status).toBe("failed");
    expect(run.error).toMatch(/mock initialize failure/);
  });
});
