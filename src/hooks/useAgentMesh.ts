/**
 * useAgentMesh.ts — authenticated React hook for the Devonn.AI Agent Mesh.
 *
 * Dispatch operations are workspace-bound. The hook resolves the current
 * Supabase access token for every request and injects workspace_id into dispatch
 * payloads so callers cannot accidentally use an anonymous execution contract.
 */

import { useState, useCallback } from 'react';
import { env } from '@/lib/env';
import { supabase } from '@/integrations/supabase/client';

export interface DispatchRequest {
  agent_name: string;
  action: string;
  payload?: Record<string, unknown>;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  timeout_seconds?: number;
  max_retries?: number;
}

export interface CapabilityDispatchRequest {
  capability: string;
  action: string;
  payload?: Record<string, unknown>;
}

export interface AgentResult {
  task_id: string;
  agent_name: string;
  success: boolean;
  data: Record<string, unknown>;
  error?: string;
  duration_ms: number;
  retries_used: number;
}

export interface AgentInfo {
  name: string;
  base_url: string;
  capabilities: string[];
  status: 'idle' | 'busy' | 'error' | 'offline';
}

export interface MeshHealth {
  overall: 'healthy' | 'degraded';
  agents: Record<string, boolean>;
}

interface UseAgentMeshState {
  isLoading: boolean;
  result: AgentResult | null;
  error: string | null;
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Authentication is required for Agent Mesh operations.');
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${env.apiUrl}${path}`, {
    ...options,
    headers: {
      ...authHeaders,
      ...(options?.headers || {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function useAgentMesh(workspaceId?: string) {
  const [state, setState] = useState<UseAgentMeshState>({
    isLoading: false,
    result: null,
    error: null,
  });

  const requireWorkspace = useCallback((): string => {
    const normalized = workspaceId?.trim();
    if (!normalized) {
      throw new Error('A workspace is required for Agent Mesh dispatch.');
    }
    return normalized;
  }, [workspaceId]);

  const dispatch = useCallback(
    async (request: DispatchRequest): Promise<AgentResult | null> => {
      setState({ isLoading: true, result: null, error: null });
      try {
        const result = await apiFetch<AgentResult>('/agents/dispatch', {
          method: 'POST',
          body: JSON.stringify({ ...request, workspace_id: requireWorkspace() }),
        });
        setState({ isLoading: false, result, error: null });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setState({ isLoading: false, result: null, error: message });
        return null;
      }
    },
    [requireWorkspace]
  );

  const dispatchByCapability = useCallback(
    async (request: CapabilityDispatchRequest): Promise<AgentResult | null> => {
      setState({ isLoading: true, result: null, error: null });
      try {
        const result = await apiFetch<AgentResult>('/agents/capability', {
          method: 'POST',
          body: JSON.stringify({ ...request, workspace_id: requireWorkspace() }),
        });
        setState({ isLoading: false, result, error: null });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setState({ isLoading: false, result: null, error: message });
        return null;
      }
    },
    [requireWorkspace]
  );

  const listAgents = useCallback(async (): Promise<AgentInfo[]> => {
    return apiFetch<AgentInfo[]>('/agents/');
  }, []);

  const getMeshHealth = useCallback(async (): Promise<MeshHealth> => {
    return apiFetch<MeshHealth>('/agents/health');
  }, []);

  return {
    dispatch,
    dispatchByCapability,
    listAgents,
    getMeshHealth,
    isLoading: state.isLoading,
    result: state.result,
    error: state.error,
  };
}
