import { useState, useCallback, useRef } from "react";
import { McpClient, type McpTool, type McpToolResult, type McpSession } from "@/lib/mcp";

export interface UseMcpGatewayOptions {
  gatewayUrl?: string;
  autoConnect?: boolean;
}

export interface UseMcpGatewayReturn {
  isConnected: boolean;
  isConnecting: boolean;
  session: McpSession | null;
  tools: McpTool[];
  error: string | null;
  connect: (url?: string, headers?: Record<string, string>) => Promise<boolean>;
  disconnect: () => Promise<void>;
  refreshTools: () => Promise<void>;
  callTool: (name: string, args?: Record<string, unknown>) => Promise<McpToolResult>;
}

export function useMcpGateway(options: UseMcpGatewayOptions = {}): UseMcpGatewayReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [session, setSession] = useState<McpSession | null>(null);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<McpClient | null>(null);
  const gatewayUrlRef = useRef(options.gatewayUrl ?? "");
  const headersRef = useRef<Record<string, string>>({});

  const connect = useCallback(async (url?: string, headers: Record<string, string> = {}) => {
    if (url) gatewayUrlRef.current = url;
    headersRef.current = headers;

    if (!gatewayUrlRef.current) {
      setError("MCP Gateway URL is not configured");
      return false;
    }

    setIsConnecting(true);
    setError(null);

    try {
      if (clientRef.current) await clientRef.current.close();

      const client = new McpClient({
        gatewayUrl: gatewayUrlRef.current,
        timeout: 30000,
        headers: headersRef.current,
      });

      const newSession = await client.initialize();
      const availableTools = await client.listTools();

      clientRef.current = client;
      setSession(newSession);
      setTools(availableTools);
      setIsConnected(true);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect to MCP Gateway";
      clientRef.current = null;
      setSession(null);
      setTools([]);
      setError(message);
      setIsConnected(false);
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (clientRef.current) await clientRef.current.close();
    clientRef.current = null;
    setIsConnected(false);
    setSession(null);
    setTools([]);
    setError(null);
  }, []);

  const refreshTools = useCallback(async () => {
    if (!clientRef.current || !isConnected) throw new Error("Not connected to MCP Gateway");
    try {
      setTools(await clientRef.current.listTools());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to refresh tools";
      setError(message);
      throw err;
    }
  }, [isConnected]);

  const callTool = useCallback(async (
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<McpToolResult> => {
    if (!clientRef.current || !isConnected) throw new Error("Not connected to MCP Gateway");
    try {
      setError(null);
      return await clientRef.current.callTool(name, args);
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
