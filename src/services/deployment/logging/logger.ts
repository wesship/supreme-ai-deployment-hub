
import { CloudProvider, DeploymentEnvironment } from '../../../types/deployment';
import { LogEntry, LoggingOptions } from './types';
import { getDefaultLoggingOptions } from './config';
import { formatLogEntry } from './formatter';
import * as logStorage from './storage';

/**
 * Advanced logging service for deployment operations
 */
export class DeploymentLogger {
  private options: LoggingOptions;
  private environment: DeploymentEnvironment;
  private provider: CloudProvider;
  
  constructor(
    environment: DeploymentEnvironment = 'development',
    provider: CloudProvider = 'aws',
    options?: Partial<LoggingOptions>
  ) {
    this.environment = environment;
    this.provider = provider;
    this.options = {
      ...getDefaultLoggingOptions(environment),
      ...options
    };
  }
  
  /**
   * Create a formatted log entry
   */
  private createLogEntry(
    level: LogEntry['level'],
    message: string,
    context?: Record<string, any>
  ): LogEntry {
    const timestamp = new Date().toISOString();
    
    // Capture stack trace for errors in development
    let stackTrace;
    if (level === 'error' && this.environment === 'development') {
      stackTrace = new Error().stack?.split('\n').slice(2).join('\n');
    }
    
    return {
      timestamp,
      level,
      message,
      context: this.options.includeContext ? {
        environment: this.environment,
        provider: this.provider,
        ...context
      } : undefined,
      stackTrace
    };
  }
  
  /**
   * Record a log entry
   */
  private log(entry: LogEntry): void {
    // Skip logs below the configured log level
    const logLevels = ['debug', 'info', 'warning', 'error'];
    const configuredLevelIndex = logLevels.indexOf(this.options.logLevel);
    const entryLevelIndex = logLevels.indexOf(entry.level);
    
    if (entryLevelIndex < configuredLevelIndex && entry.level !== 'success') {
      return;
    }
    
    // Format the log message
    const formattedMessage = formatLogEntry(entry, this.options);
    
    // Send to appropriate destinations
    if (this.options.destination === 'console' || this.options.destination === 'both') {
      switch (entry.level) {
        case 'error':
          console.error(formattedMessage, entry.context || '');
          break;
        case 'warning':
          console.warn(formattedMessage, entry.context || '');
          break;
        case 'info':
        case 'debug':
          console.info(formattedMessage, entry.context || '');
          break;
        case 'success':
          console.log('\x1b[32m%s\x1b[0m', formattedMessage, entry.context || '');
          break;
      }
      
      // Log stack trace for errors if available
      if (entry.stackTrace) {
        console.debug(entry.stackTrace);
      }
    }
    
    // Store in memory
    if (this.options.destination === 'storage' || this.options.destination === 'both') {
      logStorage.addLog(entry);
    }
  }
  
  // Public logging methods
  info(message: string, context?: Record<string, any>): void {
    this.log(this.createLogEntry('info', message, context));
  }
  
  warning(message: string, context?: Record<string, any>): void {
    this.log(this.createLogEntry('warning', message, context));
  }
  
  error(message: string, context?: Record<string, any>): void {
    this.log(this.createLogEntry('error', message, context));
  }
  
  success(message: string, context?: Record<string, any>): void {
    this.log(this.createLogEntry('success', message, context));
  }
  
  debug(message: string, context?: Record<string, any>): void {
    this.log(this.createLogEntry('debug', message, context));
  }
  
  // Additional utility methods
  getRecentLogs(count = 50): LogEntry[] {
    return logStorage.getRecentLogs(count);
  }
  
  getLogsByLevel(level: LogEntry['level'], count = 50): LogEntry[] {
    return logStorage.getLogsByLevel(level, count);
  }
  
  clearLogs(): void {
    logStorage.clearLogs();
  }
  
  // Export logs for troubleshooting
  exportLogs(): string {
    return logStorage.exportLogs();
  }
  
  // Update logger configuration
  updateOptions(options: Partial<LoggingOptions>): void {
    this.options = {
      ...this.options,
      ...options
    };
  }
  
  // Change environment or provider
  setEnvironment(environment: DeploymentEnvironment): void {
    this.environment = environment;
    // Update default logging options based on new environment
    this.options = {
      ...getDefaultLoggingOptions(environment),
      ...this.options
    };
  }
  
  setProvider(provider: CloudProvider): void {
    this.provider = provider;
  }
}
