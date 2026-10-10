
import React, { useEffect } from 'react';
import { useRuns } from '@/hooks/runs/useRuns';
import { Run } from '@/types/run';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  AlertCircle,
  RefreshCw,
  Clock,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface RunHistoryProps {
  onSelectRun?: (run: Run) => void;
  className?: string;
}

export function RunHistory({ onSelectRun, className }: RunHistoryProps) {
  const { runs, isLoading, refreshAllRuns, startPolling } = useRuns();

  useEffect(() => {
    refreshAllRuns();
  }, [refreshAllRuns]);

  const getStatusIcon = (status: string, size = "h-4 w-4") => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className={cn(size, "text-green-500")} />;
      case 'failed':
        return <XCircle className={cn(size, "text-red-500")} />;
      case 'running':
      case 'started':
        return <Loader2 className={cn(size, "text-primary animate-spin")} />;
      case 'cancelled':
        return <AlertCircle className={cn(size, "text-yellow-500")} />;
      default:
        return <Clock className={cn(size, "text-muted-foreground")} />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'running':
      case 'started':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const handleRunClick = (run: Run) => {
    onSelectRun?.(run);
    if (run.status === 'running' || run.status === 'started') {
      startPolling(run.run_id);
    }
  };

  return (
    <Card className={cn("border-primary/20 bg-card/50 backdrop-blur", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Run History</CardTitle>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={refreshAllRuns}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-[300px]">
          {runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Clock className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-sm">No runs yet</p>
              <p className="text-xs mt-1">Start a run to see history</p>
            </div>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => (
                <div
                  key={run.run_id}
                  onClick={() => handleRunClick(run)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                    "border-primary/10 hover:border-primary/30 hover:bg-primary/5",
                    "bg-background/50"
                  )}
                >
                  {getStatusIcon(run.status)}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {run.run_id.slice(0, 8)}
                      </span>
                      <Badge variant={getStatusBadgeVariant(run.status)} className="text-xs">
                        {run.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {run.job_type}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        •
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  {run.progress !== undefined && run.status === 'running' && (
                    <div className="text-xs text-primary font-medium">
                      {run.progress}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
