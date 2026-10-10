import { useCallback, useRef, useState } from "react";
import {
  getDkosIngestionArtifacts,
  getDkosIngestionRun,
  startDkosIngestion,
  type IngestionArtifactsResponse,
  type StartIngestionInput,
  type StartIngestionResponse,
} from "@/lib/dkos/ingestionClient";
import type { IngestionRun } from "@/lib/dkos/ingestionPipeline";

export type DkosIngestionHookState = {
  isStarting: boolean;
  isPolling: boolean;
  error: string | null;
  startResponse: StartIngestionResponse | null;
  run: IngestionRun | null;
  artifacts: IngestionArtifactsResponse | null;
};

const TERMINAL_STATUSES = new Set(["completed", "failed", "manual_review"]);

export function useDkosIngestion() {
  const pollTimer = useRef<number | null>(null);
  const [state, setState] = useState<DkosIngestionHookState>({
    isStarting: false,
    isPolling: false,
    error: null,
    startResponse: null,
    run: null,
    artifacts: null,
  });

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      window.clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    setState((current) => ({ ...current, isPolling: false }));
  }, []);

  const refreshRun = useCallback(async (runId: string) => {
    const run = await getDkosIngestionRun(runId);
    setState((current) => ({ ...current, run }));

    if (TERMINAL_STATUSES.has(run.status)) {
      stopPolling();
      if (run.status === "completed") {
        const artifacts = await getDkosIngestionArtifacts(runId);
        setState((current) => ({ ...current, artifacts }));
      }
    }

    return run;
  }, [stopPolling]);

  const startPolling = useCallback((runId: string, intervalMs = 3000) => {
    stopPolling();
    setState((current) => ({ ...current, isPolling: true }));

    pollTimer.current = window.setInterval(() => {
      refreshRun(runId).catch((error) => {
        setState((current) => ({ ...current, error: error instanceof Error ? error.message : "Failed to refresh ingestion run" }));
        stopPolling();
      });
    }, intervalMs);
  }, [refreshRun, stopPolling]);

  const start = useCallback(async (input: StartIngestionInput) => {
    setState((current) => ({ ...current, isStarting: true, error: null, artifacts: null }));

    try {
      const startResponse = await startDkosIngestion(input);
      setState((current) => ({ ...current, startResponse, isStarting: false }));
      await refreshRun(startResponse.run_id).catch(() => null);
      startPolling(startResponse.run_id);
      return startResponse;
    } catch (error) {
      setState((current) => ({
        ...current,
        isStarting: false,
        error: error instanceof Error ? error.message : "Failed to start DKOS ingestion",
      }));
      throw error;
    }
  }, [refreshRun, startPolling]);

  return {
    ...state,
    start,
    refreshRun,
    startPolling,
    stopPolling,
  };
}
