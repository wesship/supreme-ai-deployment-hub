/**
 * Devonn.AI Runtime SDK — Main Client
 *
 * Usage:
 *   import { DevonnClient } from "@devonn/sdk";
 *   const client = new DevonnClient({ apiKey: "your-api-key" });
 *   const run = await client.startRun({ agentId: "...", goal: "..." });
 */

import { HttpClient } from "./httpClient.js";
import type {
  DevonnClientConfig,
  StartRunRequest,
  RunResponse,
  RunDetailsResponse,
  RunListResponse,
  RunStatus,
  DecisionTraceResponse,
} from "../types/index.js";

export class DevonnClient {
  private readonly http: HttpClient;

  constructor(config: DevonnClientConfig) {
    this.http = new HttpClient(config);
  }

  // ---------------------------------------------------------------------------
  // Execution API
  // ---------------------------------------------------------------------------

  /**
   * Start a new autonomous agent execution run.
   * Returns immediately with a run ID; poll getRun() for status.
   */
  async startRun(request: StartRunRequest): Promise<RunResponse> {
    return this.http.post<RunResponse>("/runs", request);
  }

  /**
   * Get the status and full execution trace of a specific run.
   */
  async getRun(runId: string): Promise<RunDetailsResponse> {
    return this.http.get<RunDetailsResponse>(`/runs/${encodeURIComponent(runId)}`);
  }

  /**
   * List active and historical runs, optionally filtered by status.
   */
  async listRuns(options?: { status?: RunStatus; limit?: number }): Promise<RunListResponse> {
    const params: Record<string, string | number> = {};
    if (options?.status) params.status = options.status;
    if (options?.limit !== undefined) params.limit = options.limit;
    return this.http.get<RunListResponse>("/runs", params);
  }

  /**
   * Cancel an active run. No-op if the run has already completed.
   */
  async cancelRun(runId: string): Promise<void> {
    return this.http.delete(`/runs/${encodeURIComponent(runId)}`);
  }

  /**
   * Poll a run until it reaches a terminal state (completed, failed, or blocked).
   * Throws if the run does not complete within the timeout.
   */
  async waitForRun(
    runId: string,
    options: { pollIntervalMs?: number; timeoutMs?: number } = {}
  ): Promise<RunDetailsResponse> {
    const pollIntervalMs = options.pollIntervalMs ?? 2000;
    const timeoutMs = options.timeoutMs ?? 300_000;
    const deadline = Date.now() + timeoutMs;
    const terminalStatuses: RunStatus[] = ["completed", "failed", "blocked"];

    while (Date.now() < deadline) {
      const run = await this.getRun(runId);
      if (terminalStatuses.includes(run.status)) {
        return run;
      }
      await sleep(pollIntervalMs);
    }

    throw new Error(`Run ${runId} did not complete within ${timeoutMs}ms`);
  }

  // ---------------------------------------------------------------------------
  // Governance API
  // ---------------------------------------------------------------------------

  /**
   * Inspect a governance arbitration decision by its conflict ID.
   */
  async getDecision(conflictId: string): Promise<DecisionTraceResponse> {
    return this.http.get<DecisionTraceResponse>(
      `/governance/decisions/${encodeURIComponent(conflictId)}`
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
