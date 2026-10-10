
import { useState, useCallback, useEffect, useRef } from 'react';
import { runsApi } from '@/api/runs/runsApi';
import { Run, RunPayload, RunStatus, RunLog } from '@/types/run';
import { toast } from '@/hooks/use-toast';

interface UseRunsOptions {
  pollInterval?: number; // ms between status polls
  autoStart?: boolean;
  onStatusChange?: (run: Run, previousStatus: RunStatus) => void;
  onComplete?: (run: Run) => void;
  onError?: (run: Run, error: string) => void;
  onLog?: (run: Run, log: RunLog) => void;
}

interface UseRunsReturn {
  // Current runs state
  runs: Run[];
  activeRun: Run | null;
  isLoading: boolean;
  isPolling: boolean;
  
  // Actions
  startRun: (payload: RunPayload) => Promise<string | null>;
  cancelRun: (runId: string) => Promise<boolean>;
  retryRun: (runId: string) => Promise<string | null>;
  refreshRun: (runId: string) => Promise<Run | null>;
  refreshAllRuns: () => Promise<void>;
  
  // Polling controls
  startPolling: (runId: string) => void;
  stopPolling: () => void;
  
  // Utility
  getRunById: (runId: string) => Run | undefined;
  clearRuns: () => void;
}

export function useRuns(options: UseRunsOptions = {}): UseRunsReturn {
  const {
    pollInterval = 2000,
    autoStart = true,
    onStatusChange,
    onComplete,
    onError,
    onLog,
  } = options;

  const [runs, setRuns] = useState<Run[]>([]);
  const [activeRun, setActiveRun] = useState<Run | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousLogsCountRef = useRef<number>(0);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const updateRun = useCallback((updatedRun: Run) => {
    setRuns(prev => {
      const index = prev.findIndex(r => r.run_id === updatedRun.run_id);
      if (index >= 0) {
        const newRuns = [...prev];
        newRuns[index] = updatedRun;
        return newRuns;
      }
      return [...prev, updatedRun];
    });

    if (activeRun?.run_id === updatedRun.run_id) {
      setActiveRun(updatedRun);
    }
  }, [activeRun]);

  const startRun = useCallback(async (payload: RunPayload): Promise<string | null> => {
    setIsLoading(true);
    try {
      const response = await runsApi.startRun(payload);
      
      const newRun: Run = {
        run_id: response.run_id,
        status: response.status,
        job_type: payload.job_type,
        parameters: payload.parameters,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        logs: [],
      };

      setRuns(prev => [...prev, newRun]);
      setActiveRun(newRun);

      toast({
        title: "Run Started",
        description: `Job ${response.run_id.slice(0, 8)}... has been dispatched`,
      });

      // Auto-start polling if enabled
      if (autoStart) {
        startPolling(response.run_id);
      }

      return response.run_id;
    } catch (error) {
      console.error('Failed to start run:', error);
      toast({
        title: "Failed to Start Run",
        description: "Could not dispatch job to the execution engine",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [autoStart]);

  const startPolling = useCallback((runId: string) => {
    // Clear any existing polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    setIsPolling(true);
    previousLogsCountRef.current = 0;

    const poll = async () => {
      try {
        const response = await runsApi.getRunStatus(runId);
        const run = response.run;

        // Check for status changes
        const existingRun = runs.find(r => r.run_id === runId);
        if (existingRun && existingRun.status !== run.status) {
          onStatusChange?.(run, existingRun.status);
        }

        // Check for new logs
        if (run.logs && run.logs.length > previousLogsCountRef.current) {
          const newLogs = run.logs.slice(previousLogsCountRef.current);
          newLogs.forEach(log => onLog?.(run, log));
          previousLogsCountRef.current = run.logs.length;
        }

        updateRun(run);

        // Stop polling if run is complete
        if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') {
          stopPolling();
          
          if (run.status === 'completed') {
            onComplete?.(run);
            toast({
              title: "Run Completed",
              description: `Job ${runId.slice(0, 8)}... finished successfully`,
            });
          } else if (run.status === 'failed') {
            onError?.(run, run.error || 'Unknown error');
            toast({
              title: "Run Failed",
              description: run.error || "Job failed with unknown error",
              variant: "destructive",
            });
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };

    // Initial poll
    poll();

    // Set up interval
    pollIntervalRef.current = setInterval(poll, pollInterval);
  }, [runs, pollInterval, onStatusChange, onComplete, onError, onLog, updateRun]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const cancelRun = useCallback(async (runId: string): Promise<boolean> => {
    try {
      await runsApi.cancelRun(runId);
      
      setRuns(prev => prev.map(r => 
        r.run_id === runId ? { ...r, status: 'cancelled' as RunStatus } : r
      ));

      if (activeRun?.run_id === runId) {
        setActiveRun(prev => prev ? { ...prev, status: 'cancelled' } : null);
      }

      stopPolling();
      
      toast({
        title: "Run Cancelled",
        description: `Job ${runId.slice(0, 8)}... has been cancelled`,
      });

      return true;
    } catch (error) {
      console.error('Failed to cancel run:', error);
      toast({
        title: "Failed to Cancel",
        description: "Could not cancel the running job",
        variant: "destructive",
      });
      return false;
    }
  }, [activeRun, stopPolling]);

  const retryRun = useCallback(async (runId: string): Promise<string | null> => {
    try {
      const response = await runsApi.retryRun(runId);
      
      toast({
        title: "Retrying Run",
        description: `New job ${response.run_id.slice(0, 8)}... has been dispatched`,
      });

      if (autoStart) {
        startPolling(response.run_id);
      }

      return response.run_id;
    } catch (error) {
      console.error('Failed to retry run:', error);
      toast({
        title: "Failed to Retry",
        description: "Could not retry the failed job",
        variant: "destructive",
      });
      return null;
    }
  }, [autoStart, startPolling]);

  const refreshRun = useCallback(async (runId: string): Promise<Run | null> => {
    try {
      const run = await runsApi.getRun(runId);
      updateRun(run);
      return run;
    } catch (error) {
      console.error('Failed to refresh run:', error);
      return null;
    }
  }, [updateRun]);

  const refreshAllRuns = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await runsApi.listRuns({ per_page: 50 });
      setRuns(response.runs);
    } catch (error) {
      console.error('Failed to refresh runs:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getRunById = useCallback((runId: string): Run | undefined => {
    return runs.find(r => r.run_id === runId);
  }, [runs]);

  const clearRuns = useCallback(() => {
    setRuns([]);
    setActiveRun(null);
    stopPolling();
  }, [stopPolling]);

  return {
    runs,
    activeRun,
    isLoading,
    isPolling,
    startRun,
    cancelRun,
    retryRun,
    refreshRun,
    refreshAllRuns,
    startPolling,
    stopPolling,
    getRunById,
    clearRuns,
  };
}
