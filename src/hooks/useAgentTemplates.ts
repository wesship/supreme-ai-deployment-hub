import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";

export interface AgentTemplate {
  id: string;
  author_id: string;
  name: string;
  description: string | null;
  category: string;
  version: string;
  icon: string | null;
  tags: string[];
  capabilities: Json;
  required_integrations: string[];
  mcp_tools: string[];
  pricing_model: string;
  price: number;
  downloads: number;
  avg_rating: number;
  review_count: number;
  status: string;
  is_featured: boolean;
  is_verified: boolean;
  config_schema: Json;
  default_config: Json;
  created_at: string;
  updated_at: string;
}

export interface AgentTemplateFilters {
  category?: string;
  search?: string;
  pricing_model?: string;
  is_featured?: boolean;
}

export function useAgentTemplates(filters?: AgentTemplateFilters) {
  return useQuery({
    queryKey: ["agent-templates", filters],
    queryFn: async () => {
      let query = supabase
        .from("agent_templates")
        .select("*")
        .eq("status" as any, "published")
        .order("downloads" as any, { ascending: false });

      if (filters?.category && filters.category !== "all") {
        query = query.eq("category" as any, filters.category);
      }
      if (filters?.pricing_model) {
        query = query.eq("pricing_model" as any, filters.pricing_model);
      }
      if (filters?.is_featured) {
        query = query.eq("is_featured" as any, true);
      }
      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as AgentTemplate[];
    },
  });
}

export function useAgentTemplate(id: string) {
  return useQuery({
    queryKey: ["agent-template", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_templates")
        .select("*")
        .eq("id" as any, id)
        .single();
      if (error) throw error;
      return data as unknown as AgentTemplate;
    },
    enabled: !!id,
  });
}

export function useMyAgentTemplates() {
  return useQuery({
    queryKey: ["my-agent-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_templates")
        .select("*")
        .order("created_at" as any, { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AgentTemplate[];
    },
  });
}

export function useCreateAgentTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (template: Partial<Omit<AgentTemplate, 'id' | 'author_id' | 'created_at' | 'updated_at'>>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("agent_templates")
        .insert({
          author_id: user.id,
          name: template.name ?? "Untitled Agent",
          category: template.category ?? "general",
          description: template.description,
          version: template.version,
          icon: template.icon,
          tags: template.tags,
          capabilities: template.capabilities,
          required_integrations: template.required_integrations,
          mcp_tools: template.mcp_tools,
          pricing_model: template.pricing_model,
          price: template.price,
          status: template.status,
          is_featured: template.is_featured,
          is_verified: template.is_verified,
          config_schema: template.config_schema,
          default_config: template.default_config,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-agent-templates"] });
      toast({ title: "Template created successfully" });
    },
    onError: (error) => {
      toast({ title: "Failed to create template", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateAgentTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Omit<AgentTemplate, 'id' | 'author_id' | 'created_at' | 'updated_at'>>) => {
      const { data, error } = await supabase
        .from("agent_templates")
        .update(updates as any)
        .eq("id" as any, id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["agent-template", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["my-agent-templates"] });
      toast({ title: "Template updated successfully" });
    },
    onError: (error) => {
      toast({ title: "Failed to update template", description: error.message, variant: "destructive" });
    },
  });
}
