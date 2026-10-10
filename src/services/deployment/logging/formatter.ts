
import { LogEntry, LoggingOptions } from './types';

export const formatLogEntry = (entry: LogEntry, options: LoggingOptions): string => {
  return options.includeTimestamp 
    ? `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`
    : `${entry.level.toUpperCase()}: ${entry.message}`;
};
