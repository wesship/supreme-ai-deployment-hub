import { supabase } from '@/integrations/supabase/client';

const API_URL = (import.meta.env.VITE_API_URL || 'https://api.d3vonn.io').replace(/\/$/, '');

export interface GenesisProject {
  id: string;
  canonical_key: string;
  title: string;
  slug: string;
  project_type: string;
  description?: string | null;
  status: string;
  target_release_date?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface GenesisCounts {
  canon: number;
  locked_canon: number;
  assets: number;
  approved_assets: number;
  open_tasks: number;
  blocked_tasks: number;
  active_workflows: number;
  pending_approvals: number;
  active_agents: number;
}

export interface GenesisTask {
  id: string;
  title: string;
  task_type: string;
  priority: number;
  status: string;
  acceptance_criteria?: string[];
  dependencies?: string[];
  assigned_agent_id?: string | null;
  updated_at?: string;
}

export interface GenesisWorkflow {
  id: string;
  workflow_key: string;
  status: string;
  progress: number;
  current_phase?: string | null;
  created_at?: string;
}

export interface GenesisApproval {
  id: string;
  target_type: string;
  approval_type: string;
  status: string;
  risk_level: string;
  estimated_cost_usd?: number | null;
  requested_at?: string;
}

export interface GenesisProviderHealth {
  provider: string;
  model: string;
  configured: boolean;
  manual: boolean;
  state: string;
  capabilities: string[];
}

export interface GenesisEvaluation {
  id: string;
  evaluation_type: string;
  status: string;
  scores: Record<string, number>;
  overall_score: number;
  release_ready: boolean;
  summary?: string | null;
  started_at: string;
  completed_at?: string | null;
}

export interface GenesisFinding {
  id: string;
  severity: string;
  category: string;
  title: string;
  description?: string | null;
  remediation?: string | null;
  blocking: boolean;
  status: string;
  evidence?: Record<string, unknown>;
}

export interface GenesisReleaseGate {
  id?: string;
  gate_key: string;
  name: string;
  category: string;
  required?: boolean;
  status: string;
  evidence?: Record<string, unknown>;
}

export interface GenesisEvaluationResult {
  evaluation: GenesisEvaluation;
  findings: GenesisFinding[];
  gates: GenesisReleaseGate[];
}

export interface GenesisSnapshot {
  project: GenesisProject;
  counts: GenesisCounts;
  recent_events: Array<{
    id: string;
    event_type: string;
    aggregate_type: string;
    payload?: Record<string, unknown>;
    created_at: string;
  }>;
  goals: Array<Record<string, unknown>>;
  tasks: GenesisTask[];
  workflows: GenesisWorkflow[];
  approvals: GenesisApproval[];
  canon: Array<Record<string, unknown>>;
  render_requests: Array<Record<string, unknown>>;
  provider_health: GenesisProviderHealth[];
  implementation: Record<string, string>;
}

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Sign in is required to operate Genesis.');
  }
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers || {}) },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => 'Unknown Genesis API error');
    throw new Error(`Genesis API ${response.status}: ${body}`);
  }
  return response.json() as Promise<T>;
}

export const genesisApi = {
  health: () => request<Record<string, unknown>>('/api/genesis/health'),
  listProjects: () => request<{ projects: GenesisProject[]; count: number }>('/api/genesis/projects'),
  createProject: (payload: {
    title: string;
    project_type: string;
    description?: string;
  }) => request<{ project: GenesisProject }>('/api/genesis/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  snapshot: (projectId: string) => request<GenesisSnapshot>(`/api/genesis/projects/${projectId}/snapshot`),
  bootstrap: (projectId: string) => request<Record<string, unknown>>(
    `/api/genesis/projects/${projectId}/workflows/bootstrap`,
    {
      method: 'POST',
      body: JSON.stringify({
        include_render_readiness: true,
        include_release_readiness: true,
      }),
    },
  ),
  createGoal: (projectId: string, payload: {
    title: string;
    objective: string;
    success_criteria?: string[];
    constraints?: string[];
  }) => request<Record<string, unknown>>(`/api/genesis/projects/${projectId}/goals`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  createRenderRequest: (projectId: string, payload: {
    domain: string;
    operation: string;
    objective: string;
    routing_profile: string;
    normalized_request: Record<string, unknown>;
    maximum_cost_usd?: number;
    idempotency_key: string;
  }) => request<Record<string, unknown>>(`/api/genesis/projects/${projectId}/render-requests`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  transitionTask: (taskId: string, status: string) => request<{ task: GenesisTask }>(
    `/api/genesis/tasks/${taskId}/transition`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    },
  ),
  runEvaluation: (projectId: string) => request<GenesisEvaluationResult>(
    `/api/genesis/projects/${projectId}/evaluate`,
    { method: 'POST' },
  ),
  getEvaluations: (projectId: string) => request<{
    evaluations: GenesisEvaluation[];
    findings: GenesisFinding[];
    gates: GenesisReleaseGate[];
  }>(`/api/genesis/projects/${projectId}/evaluations`),
  decideApproval: (approvalId: string, decision: 'approved' | 'approved_with_conditions' | 'rejected') =>
    request<Record<string, unknown>>(`/api/genesis/approvals/${approvalId}/decide`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    }),
};
