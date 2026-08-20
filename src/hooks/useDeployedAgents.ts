import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";

export type MarketplaceInstallationStatus = "starting" | "running" | "stopped" | "paused" | "error" | "revoked" | "configuring" | "suspended";

export interface McpConfig { gateway_url: string | null; enabled_tools: string[]; }

export interface DeployedAgent {
  id: string; user_id: string; catalog_key: string | null; template_id: string | null; name: string; config: Json; mcp_config: Json;
  status: MarketplaceInstallationStatus; health_score: number; last_heartbeat: string | null; total_runs: number; successful_runs: number; failed_runs: number;
  cpu_usage: number; memory_usage: number; requested_at: string; verified_at: string | null; last_error: string | null; deployed_at: string; updated_at: string;
}

export interface DeployAgentInput { catalog_key: string; name: string; config?: Record<string, unknown>; mcp_config?: Partial<McpConfig>; }

export function parseMcpConfig(config: Json): McpConfig {
  if (typeof config === 'object' && config !== null && !Array.isArray(config)) {
    return { gateway_url: typeof config.gateway_url === 'string' ? config.gateway_url : null, enabled_tools: Array.isArray(config.enabled_tools) ? config.enabled_tools as string[] : [] };
  }
  return { gateway_url: null, enabled_tools: [] };
}

export function useDeployedAgents() {
  return useQuery({ queryKey: ["deployed-agents"], queryFn: async () => {
    const { data, error } = await (supabase as any).from("deployed_agents").select("*").order("deployed_at", { ascending: false });
    if (error) throw error; return ((data ?? []) as unknown) as DeployedAgent[];
  }});
}

export function useDeployedAgent(id: string) {
  return useQuery({ queryKey: ["deployed-agent", id], queryFn: async () => {
    const { data, error } = await (supabase as any).from("deployed_agents").select("*").eq("id", id).single();
    if (error) throw error; return data as unknown as DeployedAgent;
  }, enabled: !!id });
}

export function useDeployAgent() {
  const queryClient = useQueryClient(); const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: DeployAgentInput) => {
      const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error("Not authenticated");
      const mcpConfig: McpConfig = { gateway_url: input.mcp_config?.gateway_url ?? null, enabled_tools: input.mcp_config?.enabled_tools ?? [] };
      const { data, error } = await (supabase as any).rpc("marketplace_install_agent", { p_catalog_key: input.catalog_key, p_name: input.name, p_config: (input.config ?? {}) as Json, p_mcp_config: mcpConfig as unknown as Json });
      if (error) throw error; return data as DeployedAgent;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["deployed-agents"] }); toast({ title: "Agent deployed successfully", description: "Your governed installation is now starting up." }); },
    onError: (error) => toast({ title: "Failed to deploy agent", description: error.message, variant: "destructive" }),
  });
}

export function useUpdateDeployedAgent() {
  const queryClient = useQueryClient(); const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, status, last_error }: { id: string; status: MarketplaceInstallationStatus; last_error?: string | null }) => {
      const { data, error } = await (supabase as any).rpc("marketplace_update_installation_status", { p_id: id, p_status: status, p_last_error: last_error ?? null });
      if (error) throw error; return data as DeployedAgent;
    },
    onSuccess: (_, variables) => { queryClient.invalidateQueries({ queryKey: ["deployed-agent", variables.id] }); queryClient.invalidateQueries({ queryKey: ["deployed-agents"] }); toast({ title: "Agent updated" }); },
    onError: (error) => toast({ title: "Failed to update agent", description: error.message, variant: "destructive" }),
  });
}

export function useDeleteDeployedAgent() {
  const queryClient = useQueryClient(); const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => { const { data, error } = await (supabase as any).rpc("marketplace_uninstall_agent", { p_id: id }); if (error) throw error; if (!data) throw new Error("Installation not found or already removed"); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["deployed-agents"] }); toast({ title: "Agent uninstalled" }); },
    onError: (error) => toast({ title: "Failed to uninstall agent", description: error.message, variant: "destructive" }),
  });
}

export function useStartAgent() { const updateAgent = useUpdateDeployedAgent(); return useMutation({ mutationFn: async (id: string) => updateAgent.mutateAsync({ id, status: "running" }) }); }
export function useStopAgent() { const updateAgent = useUpdateDeployedAgent(); return useMutation({ mutationFn: async (id: string) => updateAgent.mutateAsync({ id, status: "stopped" }) }); }
