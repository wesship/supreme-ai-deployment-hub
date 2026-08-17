import { useCallback, useState } from 'react';
import { env } from '@/lib/env';
import { supabase } from '@/integrations/supabase/client';

export interface PrimetimeWorkspace {
  id: string;
  name: string;
  slug?: string;
  status?: string;
}

export interface CanaryAuditEvent {
  id: string;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CanaryApproval {
  id: string;
  action: string;
  agent_name?: string | null;
  expires_at: string;
}

export interface CanaryStatus {
  workspace_id: string;
  actor_id: string;
  role: string;
  policy: {
    kill_switch_enabled: boolean;
    disabled_agents: string[];
  };
  active_approvals: CanaryApproval[];
  recent_audit: CanaryAuditEvent[];
}

export interface CanaryHttpResult {
  ok: boolean;
  status: number;
  detail: string;
  body: Record<string, unknown> | null;
}

export interface GovernanceDryRunResult {
  workspace_id: string;
  actor_id: string;
  role: string;
  capability: string;
  agent_name: string;
  decision: string;
  reason: string;
  missing_permissions: string[];
  executed: boolean;
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Your authenticated D3VONN session is required. Please sign in again.');
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${env.apiUrl}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.detail ?? `HTTP ${response.status}`);
  }
  return body as T;
}

async function requestResult(path: string, options?: RequestInit): Promise<CanaryHttpResult> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${env.apiUrl}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers || {}) },
  });
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const detail =
    typeof body?.detail === 'string'
      ? body.detail
      : response.ok
        ? 'Request completed successfully.'
        : `HTTP ${response.status}`;
  return { ok: response.ok, status: response.status, detail, body };
}

export function useAgentOsCanary() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guarded = useCallback(async <T,>(operation: () => Promise<T>): Promise<T | null> => {
    setIsLoading(true);
    setError(null);
    try {
      return await operation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown Agent OS canary error.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const listWorkspaces = useCallback(
    () => guarded(() => requestJson<PrimetimeWorkspace[]>('/primetime/v1/workspaces')),
    [guarded]
  );

  const getStatus = useCallback(
    (workspaceId: string) =>
      guarded(() =>
        requestJson<CanaryStatus>(
          `/api/agents/governance/control/canary/status?workspace_id=${encodeURIComponent(workspaceId)}`
        )
      ),
    [guarded]
  );

  const dryRun = useCallback(
    (workspaceId: string, capability: string, agentName = 'devonn-coordinator') =>
      guarded(() =>
        requestJson<GovernanceDryRunResult>('/api/agents/governance/dry-run', {
          method: 'POST',
          body: JSON.stringify({
            workspace_id: workspaceId,
            agent_name: agentName,
            capability,
          }),
        })
      ),
    [guarded]
  );

  const setPolicy = useCallback(
    (workspaceId: string, killSwitchEnabled: boolean, disabledAgents: string[], reason: string) =>
      guarded(() =>
        requestJson<Record<string, unknown>>('/api/agents/governance/control/policy', {
          method: 'PUT',
          body: JSON.stringify({
            workspace_id: workspaceId,
            kill_switch_enabled: killSwitchEnabled,
            disabled_agents: disabledAgents,
            reason,
          }),
        })
      ),
    [guarded]
  );

  const dispatchNamed = useCallback(
    (workspaceId: string, action: string, payload: Record<string, unknown>) =>
      guarded(() =>
        requestResult('/api/agents/dispatch', {
          method: 'POST',
          body: JSON.stringify({
            workspace_id: workspaceId,
            agent_name: 'devonn-coordinator',
            action,
            payload,
            priority: 'low',
            timeout_seconds: 30,
            max_retries: 0,
          }),
        })
      ),
    [guarded]
  );

  const dispatchCapability = useCallback(
    (workspaceId: string, capability: string, payload: Record<string, unknown>) =>
      guarded(() =>
        requestResult('/api/agents/capability', {
          method: 'POST',
          body: JSON.stringify({
            workspace_id: workspaceId,
            capability,
            payload,
            priority: 'low',
            timeout_seconds: 30,
            max_retries: 0,
          }),
        })
      ),
    [guarded]
  );

  return {
    isLoading,
    error,
    listWorkspaces,
    getStatus,
    dryRun,
    setPolicy,
    dispatchNamed,
    dispatchCapability,
  };
}
