/**
 * D3VONN Structured Logger
 *
 * Production-grade structured JSON logging with:
 * - Tenant/workspace context propagation
 * - Correlation ID tracking
 * - Log level filtering
 * - Transport abstraction (console, file, remote)
 * - Sensitive data redaction
 * - Performance timing
 *
 * @module shared/observability/logger
 * @version 1.0.0
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export interface LogContext {
  tenantId?: string;
  workspaceId?: string;
  userId?: string;
  agentId?: string;
  correlationId?: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  duration?: number;
  service: string;
  environment: string;
  version: string;
}

export interface LogTransport {
  name: string;
  write(entry: LogEntry): void | Promise<void>;
  flush?(): void | Promise<void>;
}

export interface LoggerConfig {
  service: string;
  environment: string;
  version: string;
  level: LogLevel;
  transports: LogTransport[];
  redactKeys?: string[];
  defaultContext?: LogContext;
}

// ─────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

const DEFAULT_REDACT_KEYS = [
  "password",
  "secret",
  "token",
  "apiKey",
  "api_key",
  "authorization",
  "cookie",
  "ssn",
  "creditCard",
  "credit_card",
];

// ─────────────────────────────────────────────────────────────────
// Transports
// ─────────────────────────────────────────────────────────────────

export class ConsoleTransport implements LogTransport {
  name = "console";
  private pretty: boolean;

  constructor(options?: { pretty?: boolean }) {
    this.pretty = options?.pretty ?? false;
  }

  write(entry: LogEntry): void {
    const output = this.pretty
      ? JSON.stringify(entry, null, 2)
      : JSON.stringify(entry);

    switch (entry.level) {
      case "debug":
        console.debug(output);
        break;
      case "info":
        console.info(output);
        break;
      case "warn":
        console.warn(output);
        break;
      case "error":
      case "fatal":
        console.error(output);
        break;
    }
  }
}

export class InMemoryTransport implements LogTransport {
  name = "memory";
  entries: LogEntry[] = [];
  private maxSize: number;

  constructor(options?: { maxSize?: number }) {
    this.maxSize = options?.maxSize ?? 10000;
  }

  write(entry: LogEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.maxSize) {
      this.entries.shift();
    }
  }

  flush(): void {
    this.entries = [];
  }

  query(filter: Partial<Pick<LogEntry, "level" | "service">> & { since?: string }): LogEntry[] {
    return this.entries.filter((entry) => {
      if (filter.level && LOG_LEVELS[entry.level] < LOG_LEVELS[filter.level]) return false;
      if (filter.service && entry.service !== filter.service) return false;
      if (filter.since && entry.timestamp < filter.since) return false;
      return true;
    });
  }
}

export class BatchTransport implements LogTransport {
  name = "batch";
  private buffer: LogEntry[] = [];
  private batchSize: number;
  private flushInterval: number;
  private onFlush: (entries: LogEntry[]) => void | Promise<void>;
  private timer?: ReturnType<typeof setInterval>;

  constructor(options: {
    batchSize?: number;
    flushIntervalMs?: number;
    onFlush: (entries: LogEntry[]) => void | Promise<void>;
  }) {
    this.batchSize = options.batchSize ?? 100;
    this.flushInterval = options.flushIntervalMs ?? 5000;
    this.onFlush = options.onFlush;
    this.timer = setInterval(() => this.flush(), this.flushInterval);
  }

  write(entry: LogEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length >= this.batchSize) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = [...this.buffer];
    this.buffer = [];
    await this.onFlush(batch);
  }

  destroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.flush();
  }
}

// ─────────────────────────────────────────────────────────────────
// Logger Implementation
// ─────────────────────────────────────────────────────────────────

export class D3VONNLogger {
  private config: LoggerConfig;
  private redactKeys: Set<string>;

  constructor(config: LoggerConfig) {
    this.config = config;
    this.redactKeys = new Set([
      ...DEFAULT_REDACT_KEYS,
      ...(config.redactKeys ?? []),
    ]);
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private redact(data: Record<string, unknown>): Record<string, unknown> {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (this.redactKeys.has(key.toLowerCase())) {
        redacted[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        redacted[key] = this.redact(value as Record<string, unknown>);
      } else {
        redacted[key] = value;
      }
    }
    return redacted;
  }

  private createEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    data?: Record<string, unknown>,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.config.defaultContext, ...context },
      service: this.config.service,
      environment: this.config.environment,
      version: this.config.version,
    };

    if (data) {
      entry.data = this.redact(data);
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      };
    }

    return entry;
  }

  private emit(entry: LogEntry): void {
    for (const transport of this.config.transports) {
      try {
        transport.write(entry);
      } catch (err) {
        console.error(`[Logger] Transport ${transport.name} failed:`, err);
      }
    }
  }

  debug(message: string, context?: LogContext, data?: Record<string, unknown>): void {
    if (!this.shouldLog("debug")) return;
    this.emit(this.createEntry("debug", message, context, data));
  }

  info(message: string, context?: LogContext, data?: Record<string, unknown>): void {
    if (!this.shouldLog("info")) return;
    this.emit(this.createEntry("info", message, context, data));
  }

  warn(message: string, context?: LogContext, data?: Record<string, unknown>): void {
    if (!this.shouldLog("warn")) return;
    this.emit(this.createEntry("warn", message, context, data));
  }

  error(message: string, error?: Error, context?: LogContext, data?: Record<string, unknown>): void {
    if (!this.shouldLog("error")) return;
    this.emit(this.createEntry("error", message, context, data, error ?? undefined));
  }

  fatal(message: string, error?: Error, context?: LogContext, data?: Record<string, unknown>): void {
    if (!this.shouldLog("fatal")) return;
    this.emit(this.createEntry("fatal", message, context, data, error ?? undefined));
  }

  /**
   * Create a child logger with additional default context
   */
  child(context: LogContext): D3VONNLogger {
    return new D3VONNLogger({
      ...this.config,
      defaultContext: { ...this.config.defaultContext, ...context },
    });
  }

  /**
   * Time an operation and log its duration
   */
  time(label: string, context?: LogContext): () => void {
    const start = performance.now();
    return () => {
      const duration = Math.round(performance.now() - start);
      this.info(`${label} completed`, context, { duration, durationMs: duration });
    };
  }

  /**
   * Flush all transports
   */
  async flush(): Promise<void> {
    for (const transport of this.config.transports) {
      if (transport.flush) {
        await transport.flush();
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────

export function createLogger(options?: Partial<LoggerConfig>): D3VONNLogger {
  const config: LoggerConfig = {
    service: options?.service ?? "d3vonn-platform",
    environment: options?.environment ?? (process.env.NODE_ENV ?? "development"),
    version: options?.version ?? "2.0.0-alpha.1",
    level: options?.level ?? "info",
    transports: options?.transports ?? [new ConsoleTransport()],
    redactKeys: options?.redactKeys,
    defaultContext: options?.defaultContext,
  };

  return new D3VONNLogger(config);
}
