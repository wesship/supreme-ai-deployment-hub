
import { 
  Task, 
  Agent, 
  AgentResponse, 
  AgentsListResponse, 
  AgentType
} from "@/types/agent";
import { apiClient, handleApiError, withRetry } from "../core/apiClient";

// Agent CRUD operations
export const agentCoreApi = {
  // Get list of all agents
  listAgents: async (): Promise<AgentsListResponse> => {
    return withRetry(async () => {
      try {
        const response = await apiClient.get("/agents");
        return response.data;
      } catch (error) {
        return handleApiError(error, "Error fetching agents");
      }
    });
  },
  
  // Get agents by type
  listAgentsByType: async (type: AgentType): Promise<AgentsListResponse> => {
    return withRetry(async () => {
      try {
        const response = await apiClient.get(`/agents/type/${type}`);
        return response.data;
      } catch (error) {
        return handleApiError(error, `Error fetching ${type} agents`);
      }
    });
  },
  
  // Get agent details
  getAgentDetails: async (agentId: string): Promise<Agent> => {
    return withRetry(async () => {
      try {
        const response = await apiClient.get(`/agents/${agentId}`);
        return response.data;
      } catch (error) {
        return handleApiError(error, `Error fetching agent ${agentId}`);
      }
    });
  },
  
  // Generate a new agent or use existing one
  generateAgent: async (task: Task): Promise<AgentResponse> => {
    try {
      const response = await apiClient.post("/generate-agent", task);
      return response.data;
    } catch (error) {
      return handleApiError(error, "Error generating agent");
    }
  },
  
  // Run an existing agent with a task
  runAgent: async (agentId: string, task: Task): Promise<AgentResponse> => {
    try {
      const response = await apiClient.post(`/run-agent/${agentId}`, task);
      // Convert AgentRunResponse to AgentResponse format by adding required fields
      const data: AgentResponse = {
        ...response.data,
        agent_id: agentId,
        existing: true
      };
      return data;
    } catch (error) {
      return handleApiError(error, `Error running agent ${agentId}`);
    }
  },
  
  // Get UI button configuration
  getButtonConfig: async (): Promise<any> => {
    return withRetry(async () => {
      try {
        const response = await apiClient.get("/ui/button");
        return response.data;
      } catch (error) {
        return handleApiError(error, "Error fetching button config");
      }
    });
  },
  
  // Create an agent with specific type and capabilities
  createTypedAgent: async (agent: Omit<Agent, 'id'>): Promise<Agent> => {
    try {
      const response = await apiClient.post('/agents/create', agent);
      return response.data;
    } catch (error) {
      return handleApiError(error, "Error creating typed agent");
    }
  }
};
