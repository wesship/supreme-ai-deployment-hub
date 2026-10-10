
import { useCallback } from "react";
import { toast } from "sonner";
import { 
  Task, 
  Agent, 
  AgentResponse, 
  AgentType
} from "@/types/agent";
import { AgentCoreService } from "@/services/agent/coreService";

/**
 * Hook with agent operations (fetch, create, run)
 */
export const useAgentOperations = (
  stateProps: {
    setAgents: (agents: Agent[]) => void;
    setAgentsByType: (agentsByType: Record<AgentType, Agent[]>) => void;
    setLoading: (loading: boolean) => void;
    setGenerating: (generating: boolean) => void;
    setLastResponse: (response: string | null) => void;
    selectedAgent: Agent | null;
  }
) => {
  const { 
    setAgents, 
    setAgentsByType, 
    setLoading, 
    setGenerating, 
    setLastResponse,
    selectedAgent
  } = stateProps;

  // Fetch all agents
  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await AgentCoreService.listAgents();
      setAgents(response.agents);
      
      // Organize agents by type
      const byType: Record<AgentType, Agent[]> = {} as Record<AgentType, Agent[]>;
      response.agents.forEach(agent => {
        const type = agent.type || 'custom';
        if (!byType[type]) {
          byType[type] = [];
        }
        byType[type].push(agent);
      });
      setAgentsByType(byType);
      
    } catch (error) {
      console.error("Failed to fetch agents:", error);
      toast.error("Failed to fetch agents");
    } finally {
      setLoading(false);
    }
  }, [setAgents, setAgentsByType, setLoading]);
  
  // Alias for fetchAgents to match the name used in AgentManager.tsx
  const refreshAgents = fetchAgents;
  
  // Fetch agents by type
  const fetchAgentsByType = useCallback(async (type: AgentType) => {
    setLoading(true);
    try {
      const response = await AgentCoreService.listAgentsByType(type);
      return response.agents;
    } catch (error) {
      console.error(`Failed to fetch ${type} agents:`, error);
      toast.error(`Failed to fetch ${type} agents`);
      return [];
    } finally {
      setLoading(false);
    }
  }, [setLoading]);

  // Generate or use an existing agent
  const generateAgent = useCallback(async (task: Task): Promise<AgentResponse> => {
    setGenerating(true);
    setLastResponse(null);
    try {
      const response = await AgentCoreService.generateAgent(task);
      setLastResponse(response.output);
      
      // Refresh the agents list
      await fetchAgents();
      
      return response;
    } catch (error) {
      console.error("Failed to generate agent:", error);
      toast.error("Failed to generate agent");
      throw error;
    } finally {
      setGenerating(false);
    }
  }, [fetchAgents, setGenerating, setLastResponse]);

  // Run an existing agent
  const runAgent = useCallback(async (agentId: string, task: Task): Promise<AgentResponse> => {
    setLoading(true);
    setLastResponse(null);
    try {
      const response = await AgentCoreService.runAgent(agentId, task);
      setLastResponse(response.output);
      return response;
    } catch (error) {
      console.error(`Failed to run agent ${agentId}:`, error);
      toast.error("Failed to run agent");
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setLastResponse]);
  
  // Create a typed agent
  const createTypedAgent = useCallback(async (agent: Omit<Agent, 'id'>) => {
    setLoading(true);
    try {
      const createdAgent = await AgentCoreService.createTypedAgent(agent);
      
      // Refresh agent list
      await fetchAgents();
      
      toast.success(`Agent "${createdAgent.name}" created successfully`);
      return createdAgent;
    } catch (error) {
      console.error("Failed to create agent:", error);
      toast.error("Failed to create agent");
      throw error;
    } finally {
      setLoading(false);
    }
  }, [fetchAgents, setLoading]);

  return {
    fetchAgents,
    refreshAgents,
    fetchAgentsByType,
    generateAgent,
    runAgent,
    createTypedAgent
  };
};
