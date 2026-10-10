
import { useCallback } from "react";
import { AgentMemory, AgentMemorySearchParams } from "@/types/agent";
import { AgentMemoryService } from "@/services/agent/memoryService";

/**
 * Hook for agent memory operations
 */
export const useAgentMemory = (
  stateProps: {
    setAgentMemories: (memories: AgentMemory[]) => void;
    setMemoryLoading: (loading: boolean) => void;
  }
) => {
  const { setAgentMemories, setMemoryLoading } = stateProps;
  
  // Fetch agent memories
  const fetchAgentMemories = useCallback(async (agentId: string) => {
    setMemoryLoading(true);
    try {
      const memories = await AgentMemoryService.getAgentMemories(agentId);
      setAgentMemories(memories);
      return memories;
    } catch (error) {
      console.error(`Failed to fetch memories for agent ${agentId}:`, error);
      return [];
    } finally {
      setMemoryLoading(false);
    }
  }, [setAgentMemories, setMemoryLoading]);
  
  // Search agent memories
  const searchAgentMemory = useCallback(async (query: string, agentId?: string) => {
    setMemoryLoading(true);
    try {
      const memories = await AgentMemoryService.searchAgentMemory({ query, agent_id: agentId });
      return memories;
    } catch (error) {
      console.error("Failed to search agent memory:", error);
      return [];
    } finally {
      setMemoryLoading(false);
    }
  }, [setMemoryLoading]);

  return {
    fetchAgentMemories,
    searchAgentMemory
  };
};
