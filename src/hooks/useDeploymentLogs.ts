import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { DeploymentEnvironment, CloudProvider } from '../types/deployment';
import { DeploymentLogger, createLogger, LogEntry } from '../services/deployment/logging';

export const useDeploymentLogs = (
  environment: DeploymentEnvironment = 'development',
  provider: CloudProvider = 'aws'
) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [detailedLogs, setDetailedLogs] = useState<LogEntry[]>([]);
  const loggerRef = useRef<DeploymentLogger>(createLogger(environment, provider));
  
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    const logger = loggerRef.current;
    logger.setEnvironment(environment);
    logger.setProvider(provider);
  }, [environment, provider]);
  
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const addLog = useCallback((
    message: string, 
    type: 'info' | 'success' | 'warning' | 'error' | 'debug' = 'info', 
    context?: Record<string, any>,
    showToast: boolean = true
  ) => {
    if (!isMountedRef.current) return;
    
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
    
    setLogs(prevLogs => [...prevLogs, logEntry]);
    
    const logger = loggerRef.current;
    switch (type) {
      case 'info':
        logger.info(message, context);
        break;
      case 'success':
        logger.success(message, context);
        if (showToast) toast.success(message);
        break;
      case 'warning':
        logger.warning(message, context);
        if (showToast) toast.warning(message);
        break;
      case 'error':
        logger.error(message, context);
        if (showToast) toast.error(message);
        break;
      case 'debug':
        logger.debug(message, context);
        break;
    }
  }, []);

  const getDetailedLogs = useCallback(() => {
    if (!isMountedRef.current) return [];
    
    const recentLogs = loggerRef.current.getRecentLogs();
    setDetailedLogs(recentLogs);
    return recentLogs;
  }, []);

  const getLogsByLevel = useCallback((level: 'info' | 'success' | 'warning' | 'error' | 'debug', count: number = 50) => {
    return loggerRef.current.getLogsByLevel(level, count);
  }, []);

  const exportLogs = useCallback(() => {
    return loggerRef.current.exportLogs();
  }, []);

  const clearLogs = useCallback(() => {
    if (!isMountedRef.current) return;
    
    setLogs([]);
    setDetailedLogs([]);
    loggerRef.current.clearLogs();
  }, []);

  const searchLogs = useCallback((searchTerm: string, caseSensitive: boolean = false): string[] => {
    if (!searchTerm.trim()) return logs;
    
    return logs.filter(log => {
      if (caseSensitive) {
        return log.includes(searchTerm);
      } else {
        return log.toLowerCase().includes(searchTerm.toLowerCase());
      }
    });
  }, [logs]);

  const addBatchLogs = useCallback((messages: {message: string, type?: 'info' | 'success' | 'warning' | 'error' | 'debug'}[]) => {
    if (!isMountedRef.current) return;
    
    const newLogs = messages.map(item => {
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const type = item.type || 'info';
      return `[${timestamp}] ${type.toUpperCase()}: ${item.message}`;
    });
    
    setLogs(prevLogs => [...prevLogs, ...newLogs]);
    
    messages.forEach(item => {
      const type = item.type || 'info';
      const logger = loggerRef.current;
      
      switch (type) {
        case 'info':
          logger.info(item.message);
          break;
        case 'success':
          logger.success(item.message);
          break;
        case 'warning':
          logger.warning(item.message);
          break;
        case 'error':
          logger.error(item.message);
          break;
        case 'debug':
          logger.debug(item.message);
          break;
      }
    });
  }, []);

  return {
    logs,
    detailedLogs,
    addLog,
    addBatchLogs,
    getDetailedLogs,
    getLogsByLevel,
    exportLogs,
    clearLogs,
    searchLogs
  };
};
