
import { 
  Tool,
  Skill,
  AgentToolsResponse 
} from '@/types/agent';
import { apiClient, handleServiceError } from '../config';

export const AgentToolsService = {
  // Get available agent tools
  getAgentTools: async (): Promise<AgentToolsResponse> => {
    try {
      const response = await apiClient.get('/tools');
      return response.data;
    } catch (error) {
      return handleServiceError(error, 'Error fetching tools');
    }
  },
  
  // Get agent-specific tools
  getAgentSpecificTools: async (agentId: string): Promise<AgentToolsResponse> => {
    try {
      const response = await apiClient.get(`/agents/${agentId}/tools`);
      return response.data;
    } catch (error) {
      return handleServiceError(error, `Error fetching tools for agent ${agentId}`);
    }
  },
  
  // Extract skills from text
  extractSkills: async (text: string): Promise<Skill[]> => {
    try {
      const response = await apiClient.post('/skills/extract', { text });
      return response.data.skills;
    } catch (error) {
      return handleServiceError(error, 'Error extracting skills');
    }
  }
};
