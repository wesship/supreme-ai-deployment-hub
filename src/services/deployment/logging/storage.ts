import { LogEntry } from './types';

// Log storage for keeping logs in memory
const logStorage: LogEntry[] = [];

export const getRecentLogs = (count = 50): LogEntry[] => {
  return [...logStorage].slice(-count);
};

export const getLogsByLevel = (level: LogEntry['level'], count = 50): LogEntry[] => {
  return [...logStorage].filter(entry => entry.level === level).slice(-count);
};

export const clearLogs = (): void => {
  logStorage.length = 0;
};

export const addLog = (entry: LogEntry): void => {
  logStorage.push(entry);
};

export const exportLogs = (): string => {
  return JSON.stringify(logStorage, null, 2);
};
