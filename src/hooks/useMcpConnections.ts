import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { McpServerConfig } from "@/lib/mcp/serverRegistry";

export interface McpConnection {
  id: string;
  user_id: string;
  server_id: string;
  server_name: string;
  server_type: "stdio" | "http" | "sse";
  gateway_url: string | null;
  category: string;
  
  custom_config: Record<string, unknown> | null;
  is_active: boolean;
  last_connected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UseMcpConnectionsReturn {
  connections: McpConnection[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  saveConnection: (server: McpServerConfig, apiToken?: string) => Promise<McpConnection | null>;
  updateConnection: (connectionId: string, updates: { is_active?: boolean; gateway_url?: string; last_connected_at?: string }) => Promise<void>;
  deleteConnection: (connectionId: string) => Promise<void>;
  setActiveConnection: (connectionId: string, isActive: boolean) => Promise<void>;
  getConnectionByServerId: (serverId: string) => McpConnection | undefined;
  refreshConnections: () => Promise<void>;
}

export function useMcpConnections(): UseMcpConnectionsReturn {
  const [connections, setConnections] = useState<McpConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setConnections([]);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("mcp_connections")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      setConnections((data as McpConnection[]) ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch connections";
      setError(message);
      console.error("[useMcpConnections] Error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const saveConnection = useCallback(async (
    server: McpServerConfig,
    apiToken?: string
  ): Promise<McpConnection | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to save connections");
        return null;
      }

      // Check if connection already exists
      const existing = connections.find((c) => c.server_id === server.id);

      const connectionData = {
        user_id: user.id,
        server_id: server.id,
        server_name: server.name,
        server_type: server.type,
        gateway_url: server.gatewayUrl ?? null,
        category: server.category,
        custom_config: server.env ?? {},
        is_active: true,
        last_connected_at: new Date().toISOString(),
      };

      if (existing) {
        // Update existing connection
        const { data, error: updateError } = await supabase
          .from("mcp_connections")
          .update({
            ...connectionData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select()
          .single();

        if (updateError) throw updateError;

        setConnections((prev) =>
          prev.map((c) => (c.id === existing.id ? (data as McpConnection) : c))
        );

        toast.success(`Updated ${server.name} connection`);
        return data as McpConnection;
      } else {
        // Create new connection
        const { data, error: insertError } = await supabase
          .from("mcp_connections")
          .insert(connectionData)
          .select()
          .single();

        if (insertError) throw insertError;

        setConnections((prev) => [data as McpConnection, ...prev]);
        toast.success(`Saved ${server.name} connection`);
        return data as McpConnection;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save connection";
      toast.error(message);
      console.error("[useMcpConnections] Save error:", err);
      return null;
    }
  }, [connections]);

  const updateConnection = useCallback(async (
    connectionId: string,
    updates: Partial<Pick<McpConnection, "is_active" | "gateway_url" | "last_connected_at">>
  ) => {
    try {
      const { error: updateError } = await (supabase as any)
        .from("mcp_connections")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", connectionId);

      if (updateError) throw updateError;

      setConnections((prev) =>
        prev.map((c) => (c.id === connectionId ? { ...c, ...updates } : c))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update connection";
      toast.error(message);
      console.error("[useMcpConnections] Update error:", err);
    }
  }, []);

  const deleteConnection = useCallback(async (connectionId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from("mcp_connections")
        .delete()
        .eq("id", connectionId);

      if (deleteError) throw deleteError;

      setConnections((prev) => prev.filter((c) => c.id !== connectionId));
      toast.success("Connection removed");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete connection";
      toast.error(message);
      console.error("[useMcpConnections] Delete error:", err);
    }
  }, []);

  const setActiveConnection = useCallback(async (connectionId: string, isActive: boolean) => {
    await updateConnection(connectionId, { is_active: isActive });
  }, [updateConnection]);

  const getConnectionByServerId = useCallback(
    (serverId: string): McpConnection | undefined => {
      return connections.find((c) => c.server_id === serverId);
    },
    [connections]
  );

  return {
    connections,
    isLoading,
    error,
    saveConnection,
    updateConnection,
    deleteConnection,
    setActiveConnection,
    getConnectionByServerId,
    refreshConnections: fetchConnections,
  };
}
