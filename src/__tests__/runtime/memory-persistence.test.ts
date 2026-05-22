/**
 * Memory persistence service contract.
 *
 * Validates the wire-level contract between the agent UI and the FastAPI
 * memory backend at api.devonn.ai. We mock the HTTP layer and pin the
 * URL shape + request/response semantics — drift here breaks memory
 * continuity across agent restarts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock("@/services/config", () => ({
  apiClient: { get: mockGet, post: mockPost },
  handleServiceError: (e: unknown, msg: string) => {
    throw new Error(`${msg}: ${e instanceof Error ? e.message : String(e)}`);
  },
}));

import { AgentMemoryService } from "@/services/agent/memoryService";

describe("AgentMemoryService — persistence contract", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  it("saveAgentMemory POSTs to /agents/{id}/memory and returns memory_id", async () => {
    mockPost.mockResolvedValueOnce({ data: { memory_id: "mem-42" } });

    const out = await AgentMemoryService.saveAgentMemory("agent-1", {
      content: "user prefers dark mode",
      type: "preference",
      timestamp: new Date().toISOString(),
    } as never);

    expect(mockPost).toHaveBeenCalledWith(
      "/agents/agent-1/memory",
      expect.objectContaining({ content: "user prefers dark mode" })
    );
    expect(out.memory_id).toBe("mem-42");
  });

  it("getAgentMemories forwards search params and unwraps {memories: [...]}", async () => {
    const fixture = [{ id: "m1", content: "x" }, { id: "m2", content: "y" }];
    mockGet.mockResolvedValueOnce({ data: { memories: fixture } });

    const out = await AgentMemoryService.getAgentMemories("agent-1", { limit: 50 } as never);

    expect(mockGet).toHaveBeenCalledWith(
      "/agents/agent-1/memory",
      expect.objectContaining({ params: { limit: 50 } })
    );
    expect(out).toEqual(fixture);
  });

  it("searchAgentMemory hits the cross-agent /memory/search endpoint", async () => {
    mockGet.mockResolvedValueOnce({ data: { memories: [] } });
    await AgentMemoryService.searchAgentMemory({ query: "dark mode" } as never);
    expect(mockGet).toHaveBeenCalledWith(
      "/memory/search",
      expect.objectContaining({ params: { query: "dark mode" } })
    );
  });

  it("propagates transport errors via handleServiceError (no silent swallow)", async () => {
    mockPost.mockRejectedValueOnce(new Error("503 service unavailable"));
    await expect(
      AgentMemoryService.saveAgentMemory("a", { content: "x" } as never)
    ).rejects.toThrow(/503 service unavailable/);
  });
});
