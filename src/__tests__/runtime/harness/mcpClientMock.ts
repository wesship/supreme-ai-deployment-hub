// Mock MCP client + utilities for agent runtime tests.
// Replaces the real McpClient so we can deterministically inject tool
// catalogs, tool results, and failure modes.

import { vi } from "vitest";
import type { McpTool, McpToolResult } from "@/lib/mcp/types";

export interface MockClientOptions {
  tools?: McpTool[];
  toolBehavior?: Record<string, (args: Record<string, unknown>) => McpToolResult | Promise<McpToolResult>>;
  initializeShouldFail?: boolean;
}

export interface MockClientHandle {
  initialize: ((...a: unknown[]) => Promise<void>) & { mock: { calls: unknown[][] } };
  listTools:  ((...a: unknown[]) => Promise<McpTool[]>) & { mock: { calls: unknown[][] } };
  callTool:   ((name: string, args: Record<string, unknown>) => Promise<McpToolResult>) & { mock: { calls: unknown[][] } };
  close:      ((...a: unknown[]) => Promise<void>) & { mock: { calls: unknown[][] } };
  callLog: Array<{ name: string; args: Record<string, unknown> }>;
}

export function createMockClient(opts: MockClientOptions = {}): MockClientHandle {
  const tools = opts.tools ?? [];
  const callLog: MockClientHandle["callLog"] = [];

  const initialize = vi.fn(async () => {
    if (opts.initializeShouldFail) throw new Error("mock initialize failure");
  });
  const listTools = vi.fn(async () => tools);
  const callTool = vi.fn(async (name: string, args: Record<string, unknown>) => {
    callLog.push({ name, args });
    const behavior = opts.toolBehavior?.[name];
    if (behavior) return behavior(args);
    return {
      content: [{ type: "text", text: `mock-result:${name}` } as const],
      isError: false,
    } satisfies McpToolResult;
  });
  const close = vi.fn(async () => {});

  return { initialize, listTools, callTool, close, callLog };
}

// Wire the mock into the McpClient module. Call inside a vi.mock factory.
export function installMcpClientMock(handle: MockClientHandle) {
  return {
    McpClient: vi.fn().mockImplementation(() => handle),
  };
}

export const fakeTool = (name: string, extra: Partial<McpTool> = {}): McpTool => ({
  name,
  description: `mock tool ${name}`,
  inputSchema: { type: "object", properties: {}, required: [] },
  ...extra,
});
