import type {
  McpClientConfig,
  McpTool,
  McpToolResult,
  JsonRpcRequest,
  JsonRpcResponse,
  ListToolsResponse,
  CallToolResponse,
  InitializeResponse,
  McpSession,
} from "./types";

/**
 * MCP Gateway Client
 * 
 * Connects to Docker MCP Gateway via Streamable HTTP transport.
 * Implements JSON-RPC 2.0 protocol for MCP operations.
 * 
 * @example
 * ```ts
 * const client = new McpClient({ gatewayUrl: "http://localhost:8080/mcp" });
 * await client.initialize();
 * const tools = await client.listTools();
 * const result = await client.callTool("search", { query: "hello" });
 * ```
 */
export class McpClient {
  private config: Required<McpClientConfig>;
  private session: McpSession | null = null;
  private requestId = 0;

  constructor(config: McpClientConfig) {
    this.config = {
      gatewayUrl: config.gatewayUrl.replace(/\/$/, ""), // Remove trailing slash
      timeout: config.timeout ?? 30000,
      headers: {
        "Content-Type": "application/json",
        ...config.headers,
      },
    };
  }

  /**
   * Generate unique request ID
   */
  private nextId(): number {
    return ++this.requestId;
  }

  /**
   * Send JSON-RPC request to MCP Gateway
   */
  private async rpc<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: this.nextId(),
      method,
      params,
    };

    console.log(`[MCP] Sending ${method}:`, params);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(this.config.gatewayUrl, {
        method: "POST",
        headers: this.config.headers,
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`MCP Gateway error (${response.status}): ${errorText}`);
      }

      const json: JsonRpcResponse<T> = await response.json();

      if (json.error) {
        throw new Error(`MCP RPC error [${json.error.code}]: ${json.error.message}`);
      }

      console.log(`[MCP] Response for ${method}:`, json.result);
      return json.result as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`MCP request timeout after ${this.config.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Initialize MCP session with the gateway
   */
  async initialize(): Promise<McpSession> {
    const result = await this.rpc<InitializeResponse>("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {
        roots: { listChanged: true },
      },
      clientInfo: {
        name: "devonn-mcp-client",
        version: "1.0.0",
      },
    });

    this.session = {
      sessionId: `session-${Date.now()}`,
      serverInfo: result.serverInfo,
      capabilities: {
        tools: !!result.capabilities.tools,
        resources: !!result.capabilities.resources,
        prompts: !!result.capabilities.prompts,
      },
    };

    // Send initialized notification
    await this.notify("notifications/initialized", {});

    console.log("[MCP] Session initialized:", this.session);
    return this.session;
  }

  /**
   * Send notification (no response expected)
   */
  private async notify(method: string, params: Record<string, unknown>): Promise<void> {
    const request = {
      jsonrpc: "2.0" as const,
      method,
      params,
    };

    try {
      await fetch(this.config.gatewayUrl, {
        method: "POST",
        headers: this.config.headers,
        body: JSON.stringify(request),
      });
    } catch (error) {
      console.warn("[MCP] Notification failed:", error);
    }
  }

  /**
   * List all available tools from the MCP Gateway
   */
  async listTools(): Promise<McpTool[]> {
    const result = await this.rpc<ListToolsResponse>("tools/list", {});
    return result.tools ?? [];
  }

  /**
   * Call a tool with the given arguments
   */
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<McpToolResult> {
    const result = await this.rpc<CallToolResponse>("tools/call", {
      name,
      arguments: args,
    });

    return {
      content: result.content ?? [],
      isError: result.isError ?? false,
    };
  }

  /**
   * Get current session info
   */
  getSession(): McpSession | null {
    return this.session;
  }

  /**
   * Check if client is initialized
   */
  isInitialized(): boolean {
    return this.session !== null;
  }

  /**
   * Close the session
   */
  async close(): Promise<void> {
    if (this.session) {
      console.log("[MCP] Closing session:", this.session.sessionId);
      this.session = null;
    }
  }
}

/**
 * Create and initialize an MCP client
 */
export async function createMcpClient(config: McpClientConfig): Promise<McpClient> {
  const client = new McpClient(config);
  await client.initialize();
  return client;
}
