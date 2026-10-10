export interface WorkflowNode {
  id: string;
  type: string;
  name: string;
  parameters: Record<string, any>;
  position: { x: number; y: number };
  credentials?: string;
}

export interface WorkflowConnection {
  node: string;
  type: string;
  index: number;
}

export interface WorkflowEdge {
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  nodes: WorkflowNode[];
  connections: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  category: 'deployment' | 'ai-agent' | 'data-processing' | 'notification' | 'custom';
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  workflow: Partial<Workflow>;
  popularity: number;
  featured: boolean;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'success' | 'error' | 'waiting' | 'cancelled';
  startedAt: string;
  finishedAt?: string;
  executionData: any;
  error?: string;
}

export interface N8nCredentials {
  id: string;
  name: string;
  type: string;
  data: Record<string, any>;
}

export interface WorkflowStats {
  totalExecutions: number;
  successRate: number;
  averageExecutionTime: number;
  lastExecution?: string;
}