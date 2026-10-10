
import { apiClient, handleApiError } from "../core/apiClient";

export interface N8nWebhookPayload {
  run_id: string;
  job_type: string;
  parameters: Record<string, any>;
  callback_url: string;
}

export interface N8nWorkflowTrigger {
  workflow_id?: string;
  webhook_url: string;
  payload: Record<string, any>;
}

export interface N8nDispatchResponse {
  success: boolean;
  execution_id?: string;
  message?: string;
}

// n8n Integration API for dispatching jobs
export const n8nApi = {
  /**
   * Trigger an n8n workflow via webhook
   */
  triggerWorkflow: async (trigger: N8nWorkflowTrigger): Promise<N8nDispatchResponse> => {
    try {
      // Call n8n webhook directly (CORS handled by n8n config)
      const response = await fetch(trigger.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trigger.payload),
      });
      
      if (!response.ok) {
        throw new Error(`n8n webhook failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        execution_id: data.executionId,
        message: data.message || 'Workflow triggered successfully',
      };
    } catch (error) {
      console.error('n8n dispatch error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to trigger n8n workflow',
      };
    }
  },

  /**
   * Dispatch a run job to n8n via FastAPI proxy
   */
  dispatchRunToN8n: async (payload: N8nWebhookPayload): Promise<N8nDispatchResponse> => {
    try {
      const response = await apiClient.post("/n8n/dispatch", payload);
      return response.data;
    } catch (error) {
      return handleApiError(error, "Error dispatching to n8n");
    }
  },

  /**
   * Get n8n execution status
   */
  getExecutionStatus: async (executionId: string): Promise<{
    status: string;
    data?: Record<string, any>;
  }> => {
    try {
      const response = await apiClient.get(`/n8n/execution/${executionId}`);
      return response.data;
    } catch (error) {
      return handleApiError(error, `Error fetching n8n execution ${executionId}`);
    }
  },
};
