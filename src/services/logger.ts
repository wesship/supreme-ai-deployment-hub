
import winston from 'winston';
import { Log, LogFilterType } from '../types/logs';

// Configure the winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'mcp-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// In-memory storage for logs (for UI display)
let logStorage: Log[] = [];

/**
 * Add a log entry
 */
export const addLog = (
  message: string, 
  type: 'info' | 'error' | 'warning' | 'success' | 'debug',
  context?: Record<string, unknown>
): void => {
  const logEntry: Log = {
    message,
    timestamp: new Date().toISOString(),
    type,
    context
  };

  // Add to storage
  logStorage.push(logEntry);
  
  // Also log with winston
  logger[type === 'warning' ? 'warn' : type === 'success' ? 'info' : type](
    message,
    context
  );
};

/**
 * Get logs filtered by type and time range
 */
export const getLogs = (
  filter: LogFilterType = 'all',
  timeRange: 'all' | 'recent' | 'hour' | 'day' | 'week' = 'all'
): Log[] => {
  let filteredLogs = [...logStorage];
  
  // Apply type filter
  if (filter !== 'all') {
    filteredLogs = filteredLogs.filter(log => log.type === filter);
  }
  
  // Apply time filter
  if (timeRange !== 'all') {
    const now = new Date();
    const cutoff = new Date();
    
    switch (timeRange) {
      case 'recent':
        cutoff.setMinutes(now.getMinutes() - 5);
        break;
      case 'hour':
        cutoff.setHours(now.getHours() - 1);
        break;
      case 'day':
        cutoff.setDate(now.getDate() - 1);
        break;
      case 'week':
        cutoff.setDate(now.getDate() - 7);
        break;
    }
    
    filteredLogs = filteredLogs.filter(log => 
      new Date(log.timestamp) >= cutoff
    );
  }
  
  return filteredLogs;
};

/**
 * Get log count by type
 */
export const getLogCounts = (): { all: number; info: number; error: number; warning: number; success: number; debug: number } => {
  return {
    all: logStorage.length,
    info: logStorage.filter(log => log.type === 'info').length,
    error: logStorage.filter(log => log.type === 'error').length,
    warning: logStorage.filter(log => log.type === 'warning').length,
    success: logStorage.filter(log => log.type === 'success').length,
    debug: logStorage.filter(log => log.type === 'debug').length
  };
};

/**
 * Clear logs
 */
export const clearLogs = (): void => {
  logStorage = [];
};
