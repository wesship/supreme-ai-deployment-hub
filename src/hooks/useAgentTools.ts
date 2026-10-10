
import { useState, useCallback, useEffect } from 'react';
import { Tool } from '@/types/agent';
import { toast } from 'sonner';
import { AgentToolsService } from '@/services/agent/toolsService';

export const useAgentTools = (agentId?: string) => {
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [agentTools, setAgentTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(false);
  const [agentToolsLoading, setAgentToolsLoading] = useState(false);

  // Fetch all available tools on mount
  useEffect(() => {
    fetchAvailableTools();
  }, []);

  // Fetch agent-specific tools when agentId changes
  useEffect(() => {
    if (agentId) {
      fetchAgentTools();
    } else {
      setAgentTools([]);
    }
  }, [agentId]);

  // Fetch all available tools
  const fetchAvailableTools = useCallback(async () => {
    setLoading(true);
    try {
      const response = await AgentToolsService.getAgentTools();
      setAvailableTools(response.tools);
      return response.tools;
    } catch (error) {
      console.error('Error fetching available tools:', error);
      toast.error('Failed to fetch available tools');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch tools for a specific agent
  const fetchAgentTools = useCallback(async () => {
    if (!agentId) return [];
    
    setAgentToolsLoading(true);
    try {
      const response = await AgentToolsService.getAgentSpecificTools(agentId);
      setAgentTools(response.tools);
      return response.tools;
    } catch (error) {
      console.error(`Error fetching tools for agent ${agentId}:`, error);
      toast.error('Failed to fetch agent tools');
      return [];
    } finally {
      setAgentToolsLoading(false);
    }
  }, [agentId]);

  return {
    availableTools,
    agentTools,
    loading,
    agentToolsLoading,
    fetchAvailableTools,
    fetchAgentTools
  };
};

export default useAgentTools;
