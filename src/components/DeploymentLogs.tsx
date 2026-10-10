
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from './ui/card';
import { useDeployment } from '@/contexts/deployment';
import { useDeploymentLogFiltering } from '@/hooks/useDeploymentLogFiltering';
import { Log, TimeRangeType, LogFilterType } from '@/types/logs';
import { toast } from 'sonner';

import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

const DeploymentLogs: React.FC = () => {
  const { logs, clearLogs, addLog } = useDeployment();
  const [autoScroll, setAutoScroll] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamInterval, setStreamInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Parse string logs to Log objects
  const logObjects: Log[] = logs.map(logString => {
    // Parse log string: [YYYY-MM-DD HH:MM:SS] TYPE: Message
    const timestampMatch = logString.match(/\[([\d-]+ [\d:]+)\]/);
    const timestamp = timestampMatch ? timestampMatch[1] : new Date().toISOString();
    
    let type: 'info' | 'error' | 'warning' | 'success' | 'debug' = 'info';
    if (logString.includes('ERROR')) type = 'error';
    else if (logString.includes('WARNING')) type = 'warning';
    else if (logString.includes('SUCCESS')) type = 'success';
    else if (logString.includes('DEBUG')) type = 'debug';
    
    const messageMatch = logString.match(/\]\s*[A-Z]+:\s*(.*)/);
    const message = messageMatch ? messageMatch[1] : logString;
    
    return { message, timestamp, type };
  });
  
  const {
    logFilter,
    setLogFilter,
    timeRange,
    setTimeRange,
    searchQuery,
    setSearchQuery,
    isSearching,
    setIsSearching,
    filteredLogs,
    logCounts
  } = useDeploymentLogFiltering(logObjects);

  // Handle log export with more formats
  const exportLogs = useCallback((format: 'txt' | 'json' | 'csv' = 'txt') => {
    if (filteredLogs.length === 0) {
      toast.error('No logs to export');
      return;
    }
    
    let content = '';
    let filename = `deployment-logs-${new Date().toISOString().slice(0, 10)}`;
    let type = 'text/plain';
    
    if (format === 'txt') {
      content = filteredLogs.map(log => 
        `[${log.timestamp}] ${log.type.toUpperCase()}: ${log.message}`
      ).join('\n');
      filename += '.txt';
    } else if (format === 'json') {
      content = JSON.stringify(filteredLogs, null, 2);
      filename += '.json';
      type = 'application/json';
    } else if (format === 'csv') {
      content = 'Timestamp,Type,Message\n';
      content += filteredLogs.map(log => 
        `"${log.timestamp}","${log.type}","${log.message.replace(/"/g, '""')}"`
      ).join('\n');
      filename += '.csv';
      type = 'text/csv';
    }
    
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success(`Logs exported as ${format.toUpperCase()}`);
  }, [filteredLogs]);

  // Clear all log data
  const handleClearLogs = () => {
    clearLogs();
    toast.info('Logs cleared');
  };

  // Toggle real-time log streaming simulation
  const toggleStreaming = useCallback(() => {
    if (isStreaming) {
      if (streamInterval) {
        clearInterval(streamInterval);
        setStreamInterval(null);
      }
      setIsStreaming(false);
      toast.info('Log streaming stopped');
    } else {
      // This is a simulation - in a real app, we'd connect to a websocket or SSE
      const interval = setInterval(() => {
        const types = ['info', 'error', 'warning', 'success', 'debug'] as const;
        const randomType = types[Math.floor(Math.random() * types.length)];
        const randomMessage = `Auto-generated log message at ${new Date().toLocaleTimeString()}`;
        
        addLog(randomMessage, randomType);
      }, 3000);
      
      setStreamInterval(interval);
      setIsStreaming(true);
      toast.success('Log streaming started');
    }
  }, [isStreaming, streamInterval, addLog]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (streamInterval) {
        clearInterval(streamInterval);
      }
    };
  }, [streamInterval]);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Deployment Logs</h3>
          <div className="flex items-center space-x-2">
            <Button
              variant={isStreaming ? 'destructive' : 'default'}
              size="sm"
              onClick={toggleStreaming}
            >
              {isStreaming ? 'Stop Stream' : 'Start Stream'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleClearLogs}>
              Clear Logs
            </Button>
          </div>
        </div>
        
        <ScrollArea className="h-96 w-full border rounded-md">
          <div className="p-4 space-y-2">
            {filteredLogs.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No logs to display
              </div>
            ) : (
              filteredLogs.map((log, index) => (
                <div key={index} className="flex items-start space-x-2 text-sm">
                  <Badge variant="outline" className="text-xs shrink-0">
                    {log.type.toUpperCase()}
                  </Badge>
                  <span className="text-xs text-muted-foreground shrink-0 font-mono">
                    {log.timestamp}
                  </span>
                  <span className="flex-1 break-words">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{filteredLogs.length} logs displayed</span>
          <Button variant="outline" size="sm" onClick={() => exportLogs()}>
            Export Logs
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DeploymentLogs;
