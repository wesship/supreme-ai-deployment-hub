
import { 
  Tool,
  Skill
} from "@/types/agent";
import { apiClient, handleApiError } from "../config";

// Agent tools and skills operations
export const agentToolsApi = {
  // Get available agent tools
  getAgentTools: async (): Promise<{ tools: Tool[] }> => {
    try {
      const response = await apiClient.get("/tools");
      return response.data;
    } catch (error) {
      return handleApiError(error, "Error fetching tools");
    }
  },
  
  // Get agent-specific tools
  getAgentSpecificTools: async (agentId: string): Promise<{ tools: Tool[] }> => {
    try {
      const response = await apiClient.get(`/agents/${agentId}/tools`);
      return response.data;
    } catch (error) {
      return handleApiError(error, `Error fetching tools for agent ${agentId}`);
    }
  },
  
  // Extract skills from text
  extractSkills: async (text: string): Promise<{ skills: Skill[] }> => {
    try {
      const response = await apiClient.post('/skills/extract', { text });
      return response.data;
    } catch (error) {
      return handleApiError(error, "Error extracting skills");
    }
  }
};
