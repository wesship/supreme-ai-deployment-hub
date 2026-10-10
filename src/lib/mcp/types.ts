// MCP Protocol Types (JSON-RPC 2.0)

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: string | number;
  result?: T;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// MCP Tool Types
export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: "object";
    properties?: Record<string, McpToolParameter>;
    required?: string[];
  };
}

export interface McpToolParameter {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
}

export interface McpToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface McpToolResult {
  content: McpContent[];
  isError?: boolean;
}

export interface McpContent {
  type: "text" | "image" | "resource";
  text?: string;
  data?: string;
  mimeType?: string;
}

// Session Types
export interface McpSession {
  sessionId: string;
  serverInfo?: {
    name: string;
    version: string;
  };
  capabilities?: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
}

// Client Configuration
export interface McpClientConfig {
  gatewayUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
}

// Gateway Response Types
export interface ListToolsResponse {
  tools: McpTool[];
}

export interface CallToolResponse {
  content: McpContent[];
  isError?: boolean;
}

export interface InitializeResponse {
  protocolVersion: string;
  serverInfo: {
    name: string;
    version: string;
  };
  capabilities: {
    tools?: Record<string, unknown>;
    resources?: Record<string, unknown>;
    prompts?: Record<string, unknown>;
  };
}
