/**
 * useAgentMesh.ts — React hook for dispatching tasks to the Devonn.AI Agent Mesh
 *
 * Provides a type-safe interface for the React frontend to communicate with
 * the backend agent mesh REST API (backend/agents/router.py).
 *
 * Usage:
 *   const { dispatch, isLoading, result, error } = useAgentMesh();
 *
 *   await dispatch({
 *     agent_name: 'devonn-coordinator',
 *     action: 'plan',
 *     payload: { goal: 'Build a REST API' },
 *   });
 */

import { useState, useCallback } from 'react';
import { env } from '@/lib/env';

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Hook ──────────────────────────────────────────────────────────────────────

interface UseAgentMeshState {
  isLoading: boolean;
  result: AgentResult | null;
  error: string | null;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${env.apiUrl}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function useAgentMesh() {
  const [state, setState] = useState<UseAgentMeshState>({
    isLoading: false,
    result: null,
    error: null,
  });

  const dispatch = useCallback(async (request: DispatchRequest): Promise<AgentResult | null> => {
    setState({ isLoading: true, result: null, error: null });
    try {
      const result = await apiFetch<AgentResult>('/agents/dispatch', {
        method: 'POST',
        body: JSON.stringify(request),
      });
      setState({ isLoading: false, result, error: null });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setState({ isLoading: false, result: null, error: message });
      return null;
    }
  }, []);

  const dispatchByCapability = useCallback(
    async (request: CapabilityDispatchRequest): Promise<AgentResult | null> => {
      setState({ isLoading: true, result: null, error: null });
      try {
        const result = await apiFetch<AgentResult>('/agents/capability', {
          method: 'POST',
          body: JSON.stringify(request),
        });
        setState({ isLoading: false, result, error: null });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setState({ isLoading: false, result: null, error: message });
        return null;
      }
    },
    []
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
