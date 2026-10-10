
export interface Task {
  user_id: string;
  task_description: string;
  context?: string;
  memory_id?: string;
  tools?: string[];
}

export interface Agent {
  id: string;
  name: string;
  desc: string;
  skills?: string[];
  type?: AgentType;
  capabilities?: string[];
  tools?: string[];
  memory_enabled?: boolean;
}

export type AgentType = 
  | 'researcher' 
  | 'analyst' 
  | 'writer' 
  | 'coder' 
  | 'planner'
  | 'executor'
  | 'critic'
  | 'custom';

export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  requires_tools?: string[];
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  api_endpoint?: string;
  parameters?: ToolParameter[];
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: any;
}

export interface AgentMemory {
  id: string;
  agent_id: string;
  content: string;
  timestamp: string;
  context: string;
  task_id?: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  complexity: 'basic' | 'intermediate' | 'advanced';
  capabilities: string[];
  examples: string[];
}

export type SkillCategory = 
  | 'research' 
  | 'analysis' 
  | 'communication' 
  | 'programming' 
  | 'planning'
  | 'reasoning'
  | 'creativity'
  | 'domain-specific';

export interface AgentResponse {
  agent_id: string;
  existing: boolean;
  output: string;
  skills?: string[];
  memory_id?: string;
  tools_used?: string[];
}

export interface AgentsListResponse {
  agents: Agent[];
}

export interface AgentRunResponse {
  output: string;
  memory_id?: string;
  tools_used?: string[];
}

export interface ButtonConfigResponse {
  message: string;
  action: string;
  method: string;
  params: string[];
}

export interface DAGStep {
  agent: string;
  input?: string;
  depends_on?: string | string[];
  tools?: string[];
  memory_id?: string;
  expected_output?: string;
  fallback?: {
    agent: string;
    input?: string;
  };
  timeout_ms?: number;
  retry_count?: number;
}

export interface DAGWorkflow {
  workflow_name: string;
  workflow_description?: string;
  steps: DAGStep[];
  memory_enabled?: boolean;
  global_context?: string;
  max_concurrent_steps?: number;
}

export interface DAGResponse {
  workflow_id: string;
  status: string;
  results?: Record<string, string>;
  error?: string;
  completed_steps?: string[];
  memory_snapshots?: Record<string, string>;
}

export interface AgentMemorySearchParams {
  agent_id?: string;
  query?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  task_id?: string;
}

export interface AgentToolsResponse {
  tools: Tool[];
}
