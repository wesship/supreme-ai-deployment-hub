
import { apiClient, handleApiError } from "../core/apiClient";
import {
  RunPayload,
  StartRunResponse,
  LogRunRequest,
  LogRunResponse,
  FinishRunRequest,
  FinishRunResponse,
  RunStatusResponse,
  RunListResponse,
  Run,
} from "@/types/run";

// Devonn.ai Execution Loop API
export const runsApi = {
  /**
   * Start a new run - triggers FastAPI which dispatches to n8n/Docker MCP
   */
  startRun: async (payload: RunPayload): Promise<StartRunResponse> => {
    try {
      const response = await apiClient.post("/runs/start", payload);
      return response.data;
    } catch (error) {
      return handleApiError(error, "Error starting run");
    }
  },

  /**
   * Log run progress - called by n8n/workers to report status
   */
  logRun: async (request: LogRunRequest): Promise<LogRunResponse> => {
    try {
      const response = await apiClient.post("/runs/log", request);
      return response.data;
    } catch (error) {
      return handleApiError(error, "Error logging run");
    }
  },

  /**
   * Finish a run - mark as completed or failed with results
   */
  finishRun: async (request: FinishRunRequest): Promise<FinishRunResponse> => {
    try {
      const response = await apiClient.post("/runs/finish", request);
      return response.data;
    } catch (error) {
      return handleApiError(error, "Error finishing run");
    }
  },

  /**
   * Get current status of a run
   */
  getRunStatus: async (runId: string): Promise<RunStatusResponse> => {
    try {
      const response = await apiClient.get(`/runs/${runId}/status`);
      return response.data;
    } catch (error) {
      return handleApiError(error, `Error fetching run status for ${runId}`);
    }
  },

  /**
   * Get a specific run by ID
   */
  getRun: async (runId: string): Promise<Run> => {
    try {
      const response = await apiClient.get(`/runs/${runId}`);
      return response.data;
    } catch (error) {
      return handleApiError(error, `Error fetching run ${runId}`);
    }
  },

  /**
   * List all runs with optional filters
   */
  listRuns: async (params?: {
    status?: string;
    job_type?: string;
    page?: number;
    per_page?: number;
  }): Promise<RunListResponse> => {
    try {
      const response = await apiClient.get("/runs", { params });
      return response.data;
    } catch (error) {
      return handleApiError(error, "Error listing runs");
    }
  },

  /**
   * Cancel a running job
   */
  cancelRun: async (runId: string): Promise<{ status: string; run_id: string }> => {
    try {
      const response = await apiClient.post(`/runs/${runId}/cancel`);
      return response.data;
    } catch (error) {
      return handleApiError(error, `Error cancelling run ${runId}`);
    }
  },

  /**
   * Retry a failed run
   */
  retryRun: async (runId: string): Promise<StartRunResponse> => {
    try {
      const response = await apiClient.post(`/runs/${runId}/retry`);
      return response.data;
    } catch (error) {
      return handleApiError(error, `Error retrying run ${runId}`);
    }
  },
};
