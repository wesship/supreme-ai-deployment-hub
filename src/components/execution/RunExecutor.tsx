
import React, { useState } from 'react';
import { useRuns } from '@/hooks/runs/useRuns';
import { RunPayload, JobType, Run, RunLog } from '@/types/run';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Play, 
  Square, 
  RefreshCw, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Terminal,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RunExecutorProps {
  defaultJobType?: JobType;
  defaultParameters?: Record<string, any>;
  onRunComplete?: (run: Run) => void;
  onRunError?: (run: Run, error: string) => void;
  className?: string;
}

export function RunExecutor({
  defaultJobType = 'agent_task',
  defaultParameters = {},
  onRunComplete,
  onRunError,
  className,
}: RunExecutorProps) {
  const [logs, setLogs] = useState<RunLog[]>([]);

  const {
    activeRun,
    isLoading,
    isPolling,
    startRun,
    cancelRun,
    retryRun,
  } = useRuns({
    pollInterval: 1500,
    onComplete: (run) => {
      onRunComplete?.(run);
    },
    onError: (run, error) => {
      onRunError?.(run, error);
    },
    onLog: (run, log) => {
      setLogs(prev => [...prev, log]);
    },
    onStatusChange: (run, prevStatus) => {
      console.log(`Run ${run.run_id} changed from ${prevStatus} to ${run.status}`);
    },
  });

  const handleStartRun = async () => {
    setLogs([]);
    const payload: RunPayload = {
      job_type: defaultJobType,
      parameters: defaultParameters,
    };
    await startRun(payload);
  };

  const handleCancelRun = async () => {
    if (activeRun) {
      await cancelRun(activeRun.run_id);
    }
  };

  const handleRetryRun = async () => {
    if (activeRun) {
      setLogs([]);
      await retryRun(activeRun.run_id);
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'running':
      case 'started':
        return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
      case 'cancelled':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Zap className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadgeVariant = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'running':
      case 'started':
        return 'secondary';
      case 'cancelled':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-400';
      case 'warn':
        return 'text-yellow-400';
      case 'info':
        return 'text-primary';
      case 'debug':
        return 'text-muted-foreground';
      default:
        return 'text-foreground';
    }
  };

  const isRunning = activeRun?.status === 'running' || activeRun?.status === 'started';
  const canRetry = activeRun?.status === 'failed' || activeRun?.status === 'cancelled';

  return (
    <Card className={cn("border-primary/20 bg-card/50 backdrop-blur", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(activeRun?.status)}
            <div>
              <CardTitle className="text-lg font-semibold">
                Execution Engine
              </CardTitle>
              <CardDescription className="text-sm">
                Devonn.ai → FastAPI → n8n → Docker MCP
              </CardDescription>
            </div>
          </div>
          {activeRun && (
            <Badge variant={getStatusBadgeVariant(activeRun.status)}>
              {activeRun.status.toUpperCase()}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress indicator */}
        {isRunning && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {activeRun?.current_step || 'Processing...'}
              </span>
              <span className="text-primary">
                {activeRun?.progress ? `${activeRun.progress}%` : 'Running'}
              </span>
            </div>
            <Progress 
              value={activeRun?.progress || 0} 
              className="h-2"
            />
          </div>
        )}

        {/* Run info */}
        {activeRun && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Run ID:</span>
              <span className="ml-2 font-mono text-xs">
                {activeRun.run_id.slice(0, 12)}...
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Job Type:</span>
              <span className="ml-2">{activeRun.job_type}</span>
            </div>
          </div>
        )}

        <Separator className="bg-primary/10" />

        {/* Logs area */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Execution Logs</span>
            {isPolling && (
              <Loader2 className="h-3 w-3 animate-spin text-primary ml-auto" />
            )}
          </div>
          
          <ScrollArea className="h-48 rounded-md border border-primary/20 bg-background/50 p-3">
            {logs.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                {isRunning ? 'Waiting for logs...' : 'No logs yet. Start a run to see output.'}
              </div>
            ) : (
              <div className="space-y-1 font-mono text-xs">
                {logs.map((log, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className="text-muted-foreground shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={cn("uppercase w-12 shrink-0", getLogLevelColor(log.level))}>
                      [{log.level}]
                    </span>
                    <span className="text-foreground break-all">{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Result display */}
        {activeRun?.status === 'completed' && activeRun.result && (
          <div className="space-y-2">
            <span className="text-sm font-medium text-green-500">Result</span>
            <div className="rounded-md border border-green-500/20 bg-green-500/5 p-3">
              <pre className="text-xs overflow-auto">
                {JSON.stringify(activeRun.result, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Error display */}
        {activeRun?.status === 'failed' && activeRun.error && (
          <div className="space-y-2">
            <span className="text-sm font-medium text-red-500">Error</span>
            <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3">
              <p className="text-xs text-red-400">{activeRun.error}</p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          {!isRunning && !canRetry && (
            <Button 
              onClick={handleStartRun} 
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Start Run
            </Button>
          )}

          {isRunning && (
            <Button 
              onClick={handleCancelRun}
              variant="destructive"
              className="flex-1"
            >
              <Square className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}

          {canRetry && (
            <Button 
              onClick={handleRetryRun}
              variant="outline"
              className="flex-1"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          )}

          {canRetry && (
            <Button 
              onClick={handleStartRun}
              className="flex-1"
            >
              <Play className="h-4 w-4 mr-2" />
              New Run
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
