import { useState, useCallback, useRef } from "react";
import { McpClient, type McpTool, type McpToolResult, type McpSession } from "@/lib/mcp";

export interface UseMcpGatewayOptions {
  gatewayUrl?: string;
  autoConnect?: boolean;
}

export interface UseMcpGatewayReturn {
  // State
  isConnected: boolean;
  isConnecting: boolean;
  session: McpSession | null;
  tools: McpTool[];
  error: string | null;
  
  // Actions
  connect: (url?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  refreshTools: () => Promise<void>;
  callTool: (name: string, args?: Record<string, unknown>) => Promise<McpToolResult>;
}

/**
 * React hook for MCP Gateway integration
 * 
 * @example
 * ```tsx
 * const { connect, tools, callTool, isConnected } = useMcpGateway();
 * 
 * // Connect to gateway
 * await connect("http://localhost:8080/mcp");
 * 
 * // List available tools
 * console.log(tools);
 * 
 * // Call a tool
 * const result = await callTool("duckduckgo_search", { query: "MCP protocol" });
 * ```
 */
export function useMcpGateway(options: UseMcpGatewayOptions = {}): UseMcpGatewayReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [session, setSession] = useState<McpSession | null>(null);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const clientRef = useRef<McpClient | null>(null);
  const gatewayUrlRef = useRef(options.gatewayUrl ?? "http://localhost:8080/mcp");

  const connect = useCallback(async (url?: string) => {
    if (url) {
      gatewayUrlRef.current = url;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Close existing connection
      if (clientRef.current) {
        await clientRef.current.close();
      }

      // Create new client
      const client = new McpClient({
        gatewayUrl: gatewayUrlRef.current,
        timeout: 30000,
      });

      // Initialize session
      const newSession = await client.initialize();
      clientRef.current = client;
      setSession(newSession);
      setIsConnected(true);

      // Fetch available tools
      const availableTools = await client.listTools();
      setTools(availableTools);

      console.log("[useMcpGateway] Connected with", availableTools.length, "tools");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect to MCP Gateway";
      setError(message);
      setIsConnected(false);
      console.error("[useMcpGateway] Connection error:", err);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (clientRef.current) {
      await clientRef.current.close();
      clientRef.current = null;
    }
    setIsConnected(false);
    setSession(null);
    setTools([]);
    setError(null);
  }, []);

  const refreshTools = useCallback(async () => {
    if (!clientRef.current || !isConnected) {
      throw new Error("Not connected to MCP Gateway");
    }

    try {
      const availableTools = await clientRef.current.listTools();
      setTools(availableTools);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to refresh tools";
      setError(message);
      throw err;
    }
  }, [isConnected]);

  const callTool = useCallback(async (
    name: string,
    args: Record<string, unknown> = {}
  ): Promise<McpToolResult> => {
    if (!clientRef.current || !isConnected) {
      throw new Error("Not connected to MCP Gateway");
    }

    try {
      setError(null);
      const result = await clientRef.current.callTool(name, args);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Tool call failed";
      setError(message);
      throw err;
    }
  }, [isConnected]);

  return {
    isConnected,
    isConnecting,
    session,
    tools,
    error,
    connect,
    disconnect,
    refreshTools,
    callTool,
  };
}
