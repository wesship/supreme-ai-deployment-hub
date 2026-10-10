
import { 
  AgentMemory,
  AgentMemorySearchParams 
} from '@/types/agent';
import { apiClient, handleServiceError } from '../config';

export const AgentMemoryService = {
  // Save agent memory
  saveAgentMemory: async (agentId: string, memory: Omit<AgentMemory, 'id'>): Promise<{ memory_id: string }> => {
    try {
      const response = await apiClient.post(`/agents/${agentId}/memory`, memory);
      return response.data;
    } catch (error) {
      return handleServiceError(error, `Error saving memory for agent ${agentId}`);
    }
  },
  
  // Retrieve agent memories
  getAgentMemories: async (agentId: string, params?: AgentMemorySearchParams): Promise<AgentMemory[]> => {
    try {
      const response = await apiClient.get(`/agents/${agentId}/memory`, { params });
      return response.data.memories;
    } catch (error) {
      return handleServiceError(error, `Error fetching memories for agent ${agentId}`);
    }
  },
  
  // Search agent memory
  searchAgentMemory: async (params: AgentMemorySearchParams): Promise<AgentMemory[]> => {
    try {
      const response = await apiClient.get('/memory/search', { params });
      return response.data.memories;
    } catch (error) {
      return handleServiceError(error, 'Error searching agent memory');
    }
  }
};
