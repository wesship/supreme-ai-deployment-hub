
// Devonn.ai Execution Loop Types

export type RunStatus = 
  | 'pending' 
  | 'started' 
  | 'running' 
  | 'completed' 
  | 'failed' 
  | 'cancelled';

export type JobType = 
  | 'agent_task'
  | 'workflow'
  | 'n8n_dispatch'
  | 'docker_mcp'
  | 'custom';

export interface RunPayload {
  job_type: JobType;
  parameters: Record<string, any>;
  agent_id?: string;
  workflow_id?: string;
  n8n_webhook_url?: string;
  callback_url?: string;
}

export interface RunLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata?: Record<string, any>;
}

export interface Run {
  run_id: string;
  status: RunStatus;
  job_type: JobType;
  parameters: Record<string, any>;
  created_at: string;
  updated_at: string;
  started_at?: string;
  finished_at?: string;
  logs: RunLog[];
  result?: Record<string, any>;
  error?: string;
  progress?: number;
  current_step?: string;
}

export interface StartRunResponse {
  run_id: string;
  status: RunStatus;
  message?: string;
}

export interface LogRunRequest {
  run_id: string;
  log_data: RunLog;
}

export interface LogRunResponse {
  status: 'logged';
  run_id: string;
}

export interface FinishRunRequest {
  run_id: string;
  result_data: Record<string, any>;
  status: 'completed' | 'failed';
  error?: string;
}

export interface FinishRunResponse {
  status: 'completed' | 'failed';
  run_id: string;
}

export interface RunStatusResponse {
  run: Run;
}

export interface RunListResponse {
  runs: Run[];
  total: number;
  page: number;
  per_page: number;
}
