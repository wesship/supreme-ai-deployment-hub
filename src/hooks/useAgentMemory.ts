
import { useState, useCallback } from 'react';
import { AgentMemory, AgentMemorySearchParams } from '@/types/agent';
import { toast } from 'sonner';
import { AgentMemoryService } from '@/services/agent/memoryService';

export const useAgentMemory = (agentId?: string) => {
  const [memories, setMemories] = useState<AgentMemory[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<AgentMemory[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Fetch agent memories with optional filters
  const fetchMemories = useCallback(async (params?: Omit<AgentMemorySearchParams, 'agent_id'>) => {
    if (!agentId) {
      toast.error('No agent selected');
      return [];
    }
    
    setLoading(true);
    try {
      const memories = await AgentMemoryService.getAgentMemories(agentId, { 
        ...params, 
        agent_id: agentId 
      });
      setMemories(memories);
      return memories;
    } catch (error) {
      console.error('Error fetching agent memories:', error);
      toast.error('Failed to fetch memories');
      return [];
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  // Save new memory
  const saveMemory = useCallback(async (content: string, context: string, taskId?: string) => {
    if (!agentId) {
      toast.error('No agent selected');
      return null;
    }
    
    setLoading(true);
    try {
      const memory = {
        agent_id: agentId,
        content,
        context,
        timestamp: new Date().toISOString(),
        task_id: taskId
      };
      
      const response = await AgentMemoryService.saveAgentMemory(agentId, memory);
      
      // Refresh memories list
      await fetchMemories();
      
      toast.success('Memory saved successfully');
      return response.memory_id;
    } catch (error) {
      console.error('Error saving memory:', error);
      toast.error('Failed to save memory');
      return null;
    } finally {
      setLoading(false);
    }
  }, [agentId, fetchMemories]);

  // Search memories
  const searchMemories = useCallback(async (query: string) => {
    setSearchLoading(true);
    try {
      const params: AgentMemorySearchParams = {
        query,
        agent_id: agentId
      };
      
      const memories = await AgentMemoryService.searchAgentMemory(params);
      setSearchResults(memories);
      return memories;
    } catch (error) {
      console.error('Error searching memories:', error);
      toast.error('Failed to search memories');
      return [];
    } finally {
      setSearchLoading(false);
    }
  }, [agentId]);

  // Clear search results
  const clearSearch = useCallback(() => {
    setSearchResults([]);
  }, []);

  return {
    memories,
    loading,
    searchResults,
    searchLoading,
    fetchMemories,
    saveMemory,
    searchMemories,
    clearSearch
  };
};

export default useAgentMemory;
