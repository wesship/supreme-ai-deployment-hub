import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";

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

// Helper to safely parse mcp_config from Json
export function parseMcpConfig(config: Json): McpConfig {
  if (typeof config === 'object' && config !== null && !Array.isArray(config)) {
    return {
      gateway_url: typeof config.gateway_url === 'string' ? config.gateway_url : null,
      enabled_tools: Array.isArray(config.enabled_tools) ? config.enabled_tools as string[] : [],
    };
  }
  return { gateway_url: null, enabled_tools: [] };
}

export function useDeployedAgents() {
  return useQuery({
    queryKey: ["deployed-agents"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("deployed_agents")
        .select("*")
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const mcpConfig: McpConfig = {
        gateway_url: input.mcp_config?.gateway_url ?? null,
        enabled_tools: input.mcp_config?.enabled_tools ?? [],
      };

      const { data, error } = await (supabase as any)
        .from("deployed_agents")
        .insert({
          user_id: user.id,
          template_id: input.template_id || null,
          name: input.name,
          config: (input.config ?? {}) as Json,
          mcp_config: mcpConfig as unknown as Json,
          status: "starting",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deployed-agents"] });
      toast({ title: "Agent deployed successfully", description: "Your agent is now starting up." });
    },
    onError: (error) => {
      toast({ title: "Failed to deploy agent", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateDeployedAgent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Omit<DeployedAgent, 'id' | 'user_id' | 'deployed_at'>>) => {
      const { data, error } = await (supabase as any)
        .from("deployed_agents")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["deployed-agent", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["deployed-agents"] });
      toast({ title: "Agent updated" });
    },
    onError: (error) => {
      toast({ title: "Failed to update agent", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteDeployedAgent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("deployed_agents")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deployed-agents"] });
      toast({ title: "Agent deleted" });
    },
    onError: (error) => {
      toast({ title: "Failed to delete agent", description: error.message, variant: "destructive" });
    },
  });
}

export function useStartAgent() {
  const updateAgent = useUpdateDeployedAgent();

  return useMutation({
    mutationFn: async (id: string) => {
      return updateAgent.mutateAsync({ id, status: "running", last_heartbeat: new Date().toISOString() });
    },
  });
}

export function useStopAgent() {
  const updateAgent = useUpdateDeployedAgent();

  return useMutation({
    mutationFn: async (id: string) => {
      return updateAgent.mutateAsync({ id, status: "stopped" });
    },
  });
}
