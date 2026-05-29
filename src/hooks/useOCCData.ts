import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AIRequestLog {
  id: string;
  created_at: string;
  user_id: string | null;
  model: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | null;
  duration_ms: number | null;
  status: string;
  error_message: string | null;
  endpoint: string | null;
  request_id: string | null;
}

export interface ToolCallLog {
  id: string;
  created_at: string;
  agent_id: string;
  session_id: string | null;
  tool_name: string;
  status: string;
  duration_ms: number | null;
  error_message: string | null;
  user_id: string | null;
}

export interface AgentActivityLog {
  id: string;
  created_at: string;
  agent_id: string;
  agent_name: string | null;
  event_type: string;
  session_id: string | null;
  duration_ms: number | null;
  tokens_used: number | null;
  cost_usd: number | null;
  status: string;
  error_message: string | null;
}

export interface ErrorLog {
  id: string;
  created_at: string;
  resolved_at: string | null;
  error_type: string;
  severity: string;
  message: string;
  service: string | null;
  endpoint: string | null;
  resolved: boolean;
  occurrence_count: number;
  last_seen_at: string;
}

export interface ApprovalQueueItem {
  id: string;
  created_at: string;
  action_type: string;
  description: string;
  requested_by: string | null;
  status: string;
  priority: string;
  expires_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
}

export interface UserPlan {
  id: string;
  created_at: string;
  user_id: string;
  plan_name: string;
  plan_tier: number;
  status: string;
  tokens_limit: number;
  tokens_used: number;
  requests_limit: number;
  requests_used: number;
  reset_at: string | null;
}

export interface RAGDocument {
  id: string;
  created_at: string;
  title: string;
  description: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size_bytes: number | null;
  status: string;
  chunk_count: number | null;
  namespace: string | null;
  tags: string[] | null;
  indexed_at: string | null;
}

export interface OCCStats {
  totalAIRequests: number;
  totalTokensUsed: number;
  totalCostUsd: number;
  activeAgents: number;
  unresolvedErrors: number;
  pendingApprovals: number;
  totalRAGDocs: number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOCCData() {
  const [aiLogs, setAILogs] = useState<AIRequestLog[]>([]);
  const [toolLogs, setToolLogs] = useState<ToolCallLog[]>([]);
  const [agentLogs, setAgentLogs] = useState<AgentActivityLog[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [approvalQueue, setApprovalQueue] = useState<ApprovalQueueItem[]>([]);
  const [userPlans, setUserPlans] = useState<UserPlan[]>([]);
  const [ragDocs, setRAGDocs] = useState<RAGDocument[]>([]);
  const [stats, setStats] = useState<OCCStats>({
    totalAIRequests: 0,
    totalTokensUsed: 0,
    totalCostUsd: 0,
    activeAgents: 0,
    unresolvedErrors: 0,
    pendingApprovals: 0,
    totalRAGDocs: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        aiRes,
        toolRes,
        agentRes,
        errorRes,
        approvalRes,
        planRes,
        ragRes,
      ] = await Promise.all([
        (supabase as any).from('ai_request_logs').select('*').order('created_at', { ascending: false }).limit(100),
        (supabase as any).from('tool_call_logs').select('*').order('created_at', { ascending: false }).limit(100),
        (supabase as any).from('agent_activity_logs').select('*').order('created_at', { ascending: false }).limit(100),
        (supabase as any).from('error_logs').select('*').order('created_at', { ascending: false }).limit(100),
        (supabase as any).from('approval_queue').select('*').order('created_at', { ascending: false }).limit(50),
        (supabase as any).from('user_plans').select('*').order('created_at', { ascending: false }).limit(100),
        (supabase as any).from('rag_documents').select('*').order('created_at', { ascending: false }).limit(100),
      ]);

      if (aiRes.error) throw new Error(`AI logs: ${aiRes.error.message}`);
      if (toolRes.error) throw new Error(`Tool logs: ${toolRes.error.message}`);
      if (agentRes.error) throw new Error(`Agent logs: ${agentRes.error.message}`);
      if (errorRes.error) throw new Error(`Error logs: ${errorRes.error.message}`);
      if (approvalRes.error) throw new Error(`Approval queue: ${approvalRes.error.message}`);
      if (planRes.error) throw new Error(`User plans: ${planRes.error.message}`);
      if (ragRes.error) throw new Error(`RAG docs: ${ragRes.error.message}`);

      const aiData = (aiRes.data ?? []) as AIRequestLog[];
      const toolData = (toolRes.data ?? []) as ToolCallLog[];
      const agentData = (agentRes.data ?? []) as AgentActivityLog[];
      const errorData = (errorRes.data ?? []) as ErrorLog[];
      const approvalData = (approvalRes.data ?? []) as ApprovalQueueItem[];
      const planData = (planRes.data ?? []) as UserPlan[];
      const ragData = (ragRes.data ?? []) as RAGDocument[];

      setAILogs(aiData);
      setToolLogs(toolData);
      setAgentLogs(agentData);
      setErrorLogs(errorData);
      setApprovalQueue(approvalData);
      setUserPlans(planData);
      setRAGDocs(ragData);

      // Compute stats
      const totalTokens = aiData.reduce((s, r) => s + (r.total_tokens ?? 0), 0);
      const totalCost = aiData.reduce((s, r) => s + (r.cost_usd ?? 0), 0);
      const activeAgentIds = new Set(
        agentData.filter(a => a.event_type === 'started').map(a => a.agent_id)
      );
      const completedIds = new Set(
        agentData.filter(a => ['completed', 'failed'].includes(a.event_type)).map(a => a.agent_id)
      );
      const activeAgents = [...activeAgentIds].filter(id => !completedIds.has(id)).length;

      setStats({
        totalAIRequests: aiData.length,
        totalTokensUsed: totalTokens,
        totalCostUsd: totalCost,
        activeAgents,
        unresolvedErrors: errorData.filter(e => !e.resolved).length,
        pendingApprovals: approvalData.filter(a => a.status === 'pending').length,
        totalRAGDocs: ragData.length,
      });

      setLastRefreshed(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load OCC data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchAll, 30_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  return {
    aiLogs,
    toolLogs,
    agentLogs,
    errorLogs,
    approvalQueue,
    userPlans,
    ragDocs,
    stats,
    loading,
    error,
    lastRefreshed,
    refresh: fetchAll,
  };
}
