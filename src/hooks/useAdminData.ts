import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.d3vonn.io';

async function adminFetch(path: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Admin API error: ${res.status}`);
  return res.json();
}

export interface OverviewData {
  ai_requests_total: number;
  ai_cost_usd_total: number;
  ai_tokens_total: number;
  ai_error_count: number;
  tool_calls_total: number;
  tool_error_count: number;
  agent_tasks_total: number;
  open_errors: number;
  pending_approvals: number;
  plan_distribution: Record<string, number>;
}

export interface AiLog {
  id: string;
  user_id: string | null;
  model: string;
  provider: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  latency_ms: number | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

export interface ToolLog {
  id: string;
  user_id: string | null;
  tool_name: string;
  tool_input: Record<string, unknown> | null;
  tool_output: Record<string, unknown> | null;
  status: string;
  latency_ms: number | null;
  error_message: string | null;
  created_at: string;
}

export interface AgentLog {
  id: string;
  user_id: string | null;
  agent_type: string;
  task_summary: string | null;
  steps: unknown[];
  status: string;
  duration_ms: number | null;
  created_at: string;
}

export interface RagDocument {
  id: string;
  user_id: string;
  filename: string;
  file_size: number | null;
  chunk_count: number;
  namespace: string | null;
  status: string;
  retrieval_hits: number;
  created_at: string;
}

export interface ApprovalItem {
  id: string;
  user_id: string;
  action_type: string;
  action_data: Record<string, unknown>;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
  review_note: string | null;
  expires_at: string;
}

export interface ErrorLog {
  id: string;
  user_id: string | null;
  source: string;
  error_type: string;
  message: string;
  stack_trace: string | null;
  context: Record<string, unknown> | null;
  resolved: boolean;
  created_at: string;
}

export interface UserPlan {
  id: string;
  user_id: string;
  plan: string;
  messages_used: number;
  messages_limit: number;
  uploads_used: number;
  uploads_limit: number;
  tokens_used: number;
  tokens_limit: number;
  period_start: string;
  period_end: string;
  stripe_customer_id: string | null;
}

export function useAdminData() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [aiLogs, setAiLogs] = useState<AiLog[]>([]);
  const [toolLogs, setToolLogs] = useState<ToolLog[]>([]);
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [ragDocs, setRagDocs] = useState<RagDocument[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [plans, setPlans] = useState<UserPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, ai, tools, agents, docs, appr, errs, plns] = await Promise.allSettled([
        adminFetch('/api/admin/overview'),
        adminFetch('/api/admin/ai-logs?limit=50'),
        adminFetch('/api/admin/tool-logs?limit=50'),
        adminFetch('/api/admin/agent-logs?limit=50'),
        adminFetch('/api/admin/rag-documents'),
        adminFetch('/api/admin/approvals?status=pending'),
        adminFetch('/api/admin/errors?resolved=false'),
        adminFetch('/api/admin/plans'),
      ]);
      if (ov.status === 'fulfilled') setOverview(ov.value);
      if (ai.status === 'fulfilled') setAiLogs(ai.value);
      if (tools.status === 'fulfilled') setToolLogs(tools.value);
      if (agents.status === 'fulfilled') setAgentLogs(agents.value);
      if (docs.status === 'fulfilled') setRagDocs(docs.value);
      if (appr.status === 'fulfilled') setApprovals(appr.value);
      if (errs.status === 'fulfilled') setErrors(errs.value);
      if (plns.status === 'fulfilled') setPlans(plns.value);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const approveAction = async (id: string, decision: 'approved' | 'rejected', note?: string) => {
    await adminFetch(`/api/admin/approvals/${id}?decision=${decision}${note ? `&note=${encodeURIComponent(note)}` : ''}`);
    await refresh();
  };

  const resolveError = async (id: string) => {
    await adminFetch(`/api/admin/errors/${id}/resolve`);
    await refresh();
  };

  const deleteRagDoc = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    await fetch(`${API_URL}/api/admin/rag-documents/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    await refresh();
  };

  const updatePlan = async (userId: string, plan: string) => {
    await adminFetch(`/api/admin/plans/${userId}?plan=${plan}`);
    await refresh();
  };

  return {
    overview, aiLogs, toolLogs, agentLogs, ragDocs, approvals, errors, plans,
    loading, error, refresh,
    approveAction, resolveError, deleteRagDoc, updatePlan,
  };
}
