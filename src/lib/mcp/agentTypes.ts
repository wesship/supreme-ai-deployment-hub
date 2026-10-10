// Autonomous Agent Types for MCP Tool Execution

export interface AgentTask {
  id: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface AgentStep {
  id: string;
  type: "thought" | "tool_call" | "tool_result" | "observation" | "final_answer";
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  timestamp: string;
}

export interface AgentRunConfig {
  agentId: string;
  name: string;
  goal: string;
  maxSteps?: number;
  mcpGatewayUrl: string;
  /** Explicit MCP tool allow-list. An empty or omitted list denies all tools. */
  mcpTools?: string[];
  /** Explicitly opt into full gateway tool access when no mcpTools allow-list is provided. */
  allowAllMcpTools?: boolean;
  systemPrompt?: string;
}

export interface AgentRun {
  id: string;
  agentId: string;
  config: AgentRunConfig;
  status: "idle" | "thinking" | "executing" | "completed" | "failed" | "stopped";
  steps: AgentStep[];
  currentTask?: AgentTask;
  startedAt: string;
  completedAt?: string;
  finalResult?: string;
  error?: string;
}

export interface AgentCapability {
  name: string;
  description: string;
  mcpTools: string[];
}

// Default agent capabilities mapping MCP tools to high-level actions
export const DEFAULT_AGENT_CAPABILITIES: AgentCapability[] = [
  {
    name: "Web Search",
    description: "Search the web for information",
    mcpTools: ["duckduckgo_search", "web_search", "search"],
  },
  {
    name: "Code Execution",
    description: "Execute code snippets",
    mcpTools: ["execute_code", "run_python", "run_javascript"],
  },
  {
    name: "File Operations",
    description: "Read, write, and manage files",
    mcpTools: ["read_file", "write_file", "list_directory", "filesystem_read", "filesystem_write"],
  },
  {
    name: "GitHub Integration",
    description: "Interact with GitHub repositories",
    mcpTools: ["github_search", "github_get_file", "github_create_issue", "github_list_repos"],
  },
  {
    name: "Data Processing",
    description: "Process and transform data",
    mcpTools: ["parse_json", "transform_data", "aggregate"],
  },
];
