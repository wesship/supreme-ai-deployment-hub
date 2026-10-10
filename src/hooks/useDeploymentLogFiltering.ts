
import { useState, useMemo } from 'react';
import { Log, LogCounts, LogFilterType, TimeRangeType } from '@/types/logs';

export const useDeploymentLogFiltering = (logs: Log[]) => {
  const [logFilter, setLogFilter] = useState<LogFilterType>('all');
  const [timeRange, setTimeRange] = useState<TimeRangeType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Filter logs based on type and time range
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Type filtering
      if (logFilter !== 'all' && log.type !== logFilter) {
        return false;
      }

      // Time range filtering
      if (timeRange !== 'all') {
        const now = new Date();
        const logTime = new Date(log.timestamp);
        const diffMs = now.getTime() - logTime.getTime();
        
        if (timeRange === 'recent' && diffMs > 10 * 60 * 1000) return false;
        if (timeRange === 'hour' && diffMs > 60 * 60 * 1000) return false;
        if (timeRange === 'day' && diffMs > 24 * 60 * 60 * 1000) return false;
        if (timeRange === 'week' && diffMs > 7 * 24 * 60 * 60 * 1000) return false;
      }

      // Search filtering
      if (isSearching && searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      return true;
    });
  }, [logs, logFilter, timeRange, searchQuery, isSearching]);

  // Calculate log counts for the badges
  const logCounts: LogCounts = useMemo(() => {
    return {
      all: logs.length,
      info: logs.filter(log => log.type === 'info').length,
      warning: logs.filter(log => log.type === 'warning').length,
      error: logs.filter(log => log.type === 'error').length,
      success: logs.filter(log => log.type === 'success').length
    };
  }, [logs]);

  return {
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
  };
};
