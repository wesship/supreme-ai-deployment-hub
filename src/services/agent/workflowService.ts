
import { 
  DAGWorkflow, 
  DAGResponse 
} from '@/types/agent';
import { apiClient, handleServiceError } from '../config';

export const AgentWorkflowService = {
  // Submit a DAG workflow
  submitDAG: async (dag: DAGWorkflow): Promise<DAGResponse> => {
    try {
      const response = await apiClient.post('/dag-builder', dag);
      return response.data;
    } catch (error) {
      return handleServiceError(error, 'Error submitting DAG');
    }
  },
  
  // Get workflow status
  getWorkflowStatus: async (workflowId: string): Promise<DAGResponse> => {
    try {
      const response = await apiClient.get(`/workflow/${workflowId}/status`);
      return response.data;
    } catch (error) {
      return handleServiceError(error, `Error fetching workflow status for ${workflowId}`);
    }
  }
};
