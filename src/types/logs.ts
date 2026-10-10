
export interface Log {
  message: string;
  timestamp: string;
  type: 'info' | 'error' | 'warning' | 'success' | 'debug';
  context?: Record<string, any>;
}

export interface LogCounts {
  all: number;
  info: number;
  warning: number;
  error: number;
  success: number;
  debug?: number;
}

export type LogFilterType = 'all' | 'info' | 'warning' | 'error' | 'success' | 'debug';
export type TimeRangeType = 'all' | 'recent' | 'hour' | 'day' | 'week';
