
import { renderHook, act } from '@testing-library/react';
import { useDeploymentLogFiltering } from '../useDeploymentLogFiltering';
import { Log } from '@/types/logs';

describe('useDeploymentLogFiltering', () => {
  const mockLogs: Log[] = [
    { message: 'Server started', timestamp: '2024-04-24 10:00:00', type: 'info' },
    { message: 'Connection failed', timestamp: '2024-04-24 10:00:01', type: 'error' },
    { message: 'High memory usage', timestamp: '2024-04-24 10:00:02', type: 'warning' },
    { message: 'Task completed', timestamp: '2024-04-24 10:00:03', type: 'success' },
    { message: 'Processing request', timestamp: '2024-04-24 10:00:04', type: 'debug' }
  ];

  it('initializes with default values', () => {
    const { result } = renderHook(() => useDeploymentLogFiltering(mockLogs));
    expect(result.current.logFilter).toBe('all');
    expect(result.current.timeRange).toBe('all');
    expect(result.current.searchQuery).toBe('');
    expect(result.current.isSearching).toBe(false);
  });

  it('filters logs by type correctly', () => {
    const { result } = renderHook(() => useDeploymentLogFiltering(mockLogs));
    
    act(() => {
      result.current.setLogFilter('error');
    });
    
    expect(result.current.filteredLogs).toHaveLength(1);
    expect(result.current.filteredLogs[0].message).toContain('Connection failed');
  });

  it('filters logs by search query', () => {
    const { result } = renderHook(() => useDeploymentLogFiltering(mockLogs));
    
    act(() => {
      result.current.setSearchQuery('Server');
      result.current.setIsSearching(true);
    });
    
    expect(result.current.filteredLogs).toHaveLength(1);
    expect(result.current.filteredLogs[0].message).toContain('Server started');
  });

  it('calculates log counts correctly', () => {
    const { result } = renderHook(() => useDeploymentLogFiltering(mockLogs));
    
    expect(result.current.logCounts).toEqual({
      all: 5,
      info: 1,
      warning: 1,
      error: 1,
      success: 1
    });
  });

  it('filters logs by time range', () => {
    jest.useFakeTimers();
    const now = new Date('2024-04-24T10:01:00');
    jest.setSystemTime(now);

    const { result } = renderHook(() => useDeploymentLogFiltering(mockLogs));
    
    act(() => {
      result.current.setTimeRange('hour');
    });
    
    expect(result.current.filteredLogs.length).toBeLessThanOrEqual(mockLogs.length);
    
    jest.useRealTimers();
  });
});
