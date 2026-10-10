import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";

const API_BASE = (import.meta.env.VITE_API_URL || 'https://api.d3vonn.io').replace(/\/+$/, '');

export interface McpConfig {
  gateway_url: string | null;
  enabled_tools: string[];
}

export interface DeployedAgent {
  id: string;
  user_id: string;
  template_id: string | null;
  name: string;
  config: Json;
  mcp_config: Json;
  status: string;
  health_score: number;
  last_heartbeat: string | null;
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  cpu_usage: number;
  memory_usage: number;
  deployed_at: string;
  updated_at: string;
}

export interface DeployAgentInput {
  template_id?: string;
  name: string;
  config?: Record<string, unknown>;
  mcp_config?: Partial<McpConfig>;
}

type MarketplaceMutationResult = {
  id: string;
  agentId?: string | null;
  name?: string;
  status: string;
  authority: 'server';
};

export function parseMcpConfig(config: Json): McpConfig {
  if (typeof config === 'object' && config !== null && !Array.isArray(config)) {
    return {
      gateway_url: typeof config.gateway_url === 'string' ? config.gateway_url : null,
      enabled_tools: Array.isArray(config.enabled_tools) ? config.enabled_tools as string[] : [],
    };
  }
  return { gateway_url: null, enabled_tools: [] };
}

async function marketplaceMutation(path: string, init: RequestInit): Promise<MarketplaceMutationResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail = payload && typeof payload === 'object' && 'detail' in payload
      ? String((payload as { detail?: unknown }).detail || 'Marketplace request failed')
      : 'Marketplace request failed';
    throw new Error(detail);
  }
  return payload as MarketplaceMutationResult;
}

export function useDeployedAgents() {
  return useQuery({
    queryKey: ["deployed-agents"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("deployed_agents")
        .select("*")
        .neq("status", "revoked")
        .order("deployed_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown) as DeployedAgent[];
    },
  });
}

export function useDeployedAgent(id: string) {
  return useQuery({
    queryKey: ["deployed-agent", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("deployed_agents")
        .select("*")
        .eq("id", id)
        .neq("status", "revoked")
        .single();
      if (error) throw error;
      return data as unknown as DeployedAgent;
    },
    enabled: !!id,
  });
}

export function useDeployAgent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: DeployAgentInput) => {
      if (!input.template_id) throw new Error('Marketplace agent identity is required');
      const config = input.config ?? {};
      const notifications = config.notifications && typeof config.notifications === 'object'
        ? config.notifications as Record<string, unknown>
        : {};
      const emailValue = notifications.email;
      const email = Array.isArray(emailValue) ? emailValue[0] : emailValue;

      return marketplaceMutation('/api/marketplace/installations', {
        method: 'POST',
        body: JSON.stringify({
          agent_id: input.template_id,
          name: input.name,
          environment: typeof config.environment === 'string' ? config.environment : 'development',
          notifications: typeof email === 'string' && email ? { email } : {},
          enabled_tools: input.mcp_config?.enabled_tools ?? [],
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deployed-agents"] });
      toast({ title: "Agent deployment requested", description: "The governed runtime is starting your agent." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to deploy agent", description: error.message, variant: "destructive" });
    },
  });
}

function useLifecycleAction(action: 'start' | 'stop') {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => marketplaceMutation(`/api/marketplace/installations/${id}/lifecycle`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["deployed-agent", id] });
      queryClient.invalidateQueries({ queryKey: ["deployed-agents"] });
      toast({ title: action === 'start' ? 'Agent start requested' : 'Agent stopped' });
    },
    onError: (error: Error) => {
      toast({ title: `Failed to ${action} agent`, description: error.message, variant: "destructive" });
    },
  });
}

export function useStartAgent() {
  return useLifecycleAction('start');
}

export function useStopAgent() {
  return useLifecycleAction('stop');
}

export function useDeleteDeployedAgent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => marketplaceMutation(`/api/marketplace/installations/${id}`, {
      method: 'DELETE',
    }),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: ["deployed-agent", id] });
      queryClient.invalidateQueries({ queryKey: ["deployed-agents"] });
      toast({ title: "Agent uninstalled" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to uninstall agent", description: error.message, variant: "destructive" });
    },
  });
}
