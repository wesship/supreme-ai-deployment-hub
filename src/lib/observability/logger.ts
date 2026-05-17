// Structured logging implementation for Phase 2
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export const logger = {
  log: (level: LogLevel, message: string, meta: Record<string, any> = {}) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta,
      env: process.env.NODE_ENV || 'development'
    };
    
    // In production, this would ship to Datadog/Elasticsearch
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(logEntry));
    } else {
      console.log(`[${level}] ${message}`, Object.keys(meta).length ? meta : '');
    }
  },
  
  info: (msg: string, meta?: any) => logger.log(LogLevel.INFO, msg, meta),
  error: (msg: string, meta?: any) => logger.log(LogLevel.ERROR, msg, meta),
  warn: (msg: string, meta?: any) => logger.log(LogLevel.WARN, msg, meta),
  debug: (msg: string, meta?: any) => logger.log(LogLevel.DEBUG, msg, meta)
};
