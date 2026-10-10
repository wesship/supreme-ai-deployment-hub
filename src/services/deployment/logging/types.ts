
import { CloudProvider, DeploymentEnvironment } from '../../../types/deployment';

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success' | 'debug';
  message: string;
  context?: Record<string, any>;
  stackTrace?: string;
}

export interface LoggingOptions {
  // Determines which log levels will be recorded
  logLevel: 'debug' | 'info' | 'warning' | 'error';
  // Whether to include timestamps in log messages
  includeTimestamp: boolean;
  // Whether to include context information in log messages
  includeContext: boolean;
  // Destination for logs (console, storage, etc.)
  destination: 'console' | 'storage' | 'both';
}
