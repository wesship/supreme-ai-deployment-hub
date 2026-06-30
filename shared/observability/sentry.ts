/**
 * D3VONN Sentry Integration
 *
 * Error tracking and performance monitoring:
 * - Frontend/backend Sentry configuration
 * - Tenant-aware error grouping
 * - Agent error context enrichment
 * - Performance transaction tracking
 * - Release health monitoring
 * - Custom breadcrumbs for event bus
 *
 * @module shared/observability/sentry
 * @version 1.0.0
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export interface SentryConfig {
  dsn: string;
  environment: string;
  release: string;
  tracesSampleRate: number;
  profilesSampleRate: number;
  replaysSessionSampleRate: number;
  replaysOnErrorSampleRate: number;
  enableTracing: boolean;
  enableProfiling: boolean;
  enableReplay: boolean;
  beforeSend?: (event: SentryEvent) => SentryEvent | null;
  integrations?: string[];
}

export interface SentryEvent {
  event_id: string;
  timestamp: string;
  level: "fatal" | "error" | "warning" | "info" | "debug";
  message?: string;
  exception?: {
    type: string;
    value: string;
    stacktrace?: string;
  };
  tags: Record<string, string>;
  extra: Record<string, unknown>;
  user?: {
    id: string;
    email?: string;
    tenantId?: string;
  };
  contexts: Record<string, Record<string, unknown>>;
  breadcrumbs: SentryBreadcrumb[];
  transaction?: string;
  fingerprint?: string[];
}

export interface SentryBreadcrumb {
  timestamp: string;
  category: string;
  message: string;
  level: "fatal" | "error" | "warning" | "info" | "debug";
  data?: Record<string, unknown>;
}

export interface SentryTransaction {
  id: string;
  name: string;
  op: string;
  startTimestamp: string;
  status: "ok" | "cancelled" | "unknown" | "aborted" | "internal_error";
  tags: Record<string, string>;
  spans: SentrySpan[];
}

export interface SentrySpan {
  id: string;
  parentId?: string;
  op: string;
  description: string;
  startTimestamp: string;
  endTimestamp?: string;
  status: string;
  data?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────
// Default Configurations
// ─────────────────────────────────────────────────────────────────

export const SENTRY_FRONTEND_CONFIG: SentryConfig = {
  dsn: process.env.VITE_SENTRY_DSN ?? "",
  environment: process.env.NODE_ENV ?? "development",
  release: "d3vonn-platform@2.0.0-alpha.1",
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,
  enableTracing: true,
  enableProfiling: true,
  enableReplay: true,
  integrations: [
    "BrowserTracing",
    "Replay",
    "Profiling",
    "HttpClient",
    "CaptureConsole",
  ],
};

export const SENTRY_BACKEND_CONFIG: SentryConfig = {
  dsn: process.env.SENTRY_DSN ?? "",
  environment: process.env.NODE_ENV ?? "development",
  release: "d3vonn-platform@2.0.0-alpha.1",
  tracesSampleRate: 0.2,
  profilesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  enableTracing: true,
  enableProfiling: true,
  enableReplay: false,
  integrations: [
    "Http",
    "Express",
    "Postgres",
    "Prisma",
    "GraphQL",
  ],
};

// ─────────────────────────────────────────────────────────────────
// Sentry Client (Abstraction Layer)
// ─────────────────────────────────────────────────────────────────

export class D3VONNSentry {
  private config: SentryConfig;
  private initialized = false;
  private breadcrumbs: SentryBreadcrumb[] = [];
  private tags: Record<string, string> = {};
  private events: SentryEvent[] = [];
  private transactions: SentryTransaction[] = [];

  constructor(config: SentryConfig) {
    this.config = config;
  }

  init(): void {
    if (!this.config.dsn) {
      console.warn("[Sentry] No DSN configured, running in no-op mode");
      return;
    }
    this.initialized = true;
    this.addBreadcrumb({
      category: "lifecycle",
      message: "Sentry initialized",
      level: "info",
    });
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  setTag(key: string, value: string): void {
    this.tags[key] = value;
  }

  setTags(tags: Record<string, string>): void {
    Object.assign(this.tags, tags);
  }

  setTenantContext(tenantId: string, workspaceId?: string): void {
    this.tags["tenant.id"] = tenantId;
    if (workspaceId) {
      this.tags["workspace.id"] = workspaceId;
    }
  }

  setAgentContext(agentId: string, taskId?: string): void {
    this.tags["agent.id"] = agentId;
    if (taskId) {
      this.tags["agent.task_id"] = taskId;
    }
  }

  addBreadcrumb(breadcrumb: Omit<SentryBreadcrumb, "timestamp">): void {
    this.breadcrumbs.push({
      ...breadcrumb,
      timestamp: new Date().toISOString(),
    });

    // Keep last 100 breadcrumbs
    if (this.breadcrumbs.length > 100) {
      this.breadcrumbs = this.breadcrumbs.slice(-100);
    }
  }

  captureException(error: Error, context?: Record<string, unknown>): string {
    const eventId = this.generateEventId();

    const event: SentryEvent = {
      event_id: eventId,
      timestamp: new Date().toISOString(),
      level: "error",
      exception: {
        type: error.name,
        value: error.message,
        stacktrace: error.stack,
      },
      tags: { ...this.tags },
      extra: context ?? {},
      contexts: {},
      breadcrumbs: [...this.breadcrumbs],
    };

    if (this.config.beforeSend) {
      const processed = this.config.beforeSend(event);
      if (processed) {
        this.events.push(processed);
      }
    } else {
      this.events.push(event);
    }

    return eventId;
  }

  captureMessage(message: string, level: SentryEvent["level"] = "info"): string {
    const eventId = this.generateEventId();

    const event: SentryEvent = {
      event_id: eventId,
      timestamp: new Date().toISOString(),
      level,
      message,
      tags: { ...this.tags },
      extra: {},
      contexts: {},
      breadcrumbs: [...this.breadcrumbs],
    };

    this.events.push(event);
    return eventId;
  }

  startTransaction(name: string, op: string): SentryTransaction {
    const transaction: SentryTransaction = {
      id: this.generateEventId(),
      name,
      op,
      startTimestamp: new Date().toISOString(),
      status: "ok",
      tags: { ...this.tags },
      spans: [],
    };

    this.transactions.push(transaction);
    return transaction;
  }

  startSpan(transaction: SentryTransaction, op: string, description: string): SentrySpan {
    const span: SentrySpan = {
      id: this.generateEventId(),
      op,
      description,
      startTimestamp: new Date().toISOString(),
      status: "ok",
    };

    transaction.spans.push(span);
    return span;
  }

  finishSpan(span: SentrySpan, status = "ok"): void {
    span.endTimestamp = new Date().toISOString();
    span.status = status;
  }

  // Event bus integration
  addEventBusBreadcrumb(eventType: string, action: "published" | "delivered" | "failed" | "dlq"): void {
    this.addBreadcrumb({
      category: "event-bus",
      message: `Event ${eventType} ${action}`,
      level: action === "failed" || action === "dlq" ? "warning" : "info",
      data: { eventType, action },
    });
  }

  // Agent integration
  addAgentBreadcrumb(agentId: string, action: string, details?: Record<string, unknown>): void {
    this.addBreadcrumb({
      category: "agent",
      message: `Agent ${agentId}: ${action}`,
      level: "info",
      data: { agentId, action, ...details },
    });
  }

  // Get captured events (for testing)
  getCapturedEvents(): SentryEvent[] {
    return [...this.events];
  }

  getTransactions(): SentryTransaction[] {
    return [...this.transactions];
  }

  flush(): void {
    this.events = [];
    this.transactions = [];
    this.breadcrumbs = [];
  }

  private generateEventId(): string {
    return Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");
  }
}

// ─────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────

let sentryInstance: D3VONNSentry | null = null;

export function initSentry(config?: Partial<SentryConfig>): D3VONNSentry {
  const isBackend = typeof window === "undefined";
  const baseConfig = isBackend ? SENTRY_BACKEND_CONFIG : SENTRY_FRONTEND_CONFIG;

  sentryInstance = new D3VONNSentry({ ...baseConfig, ...config });
  sentryInstance.init();
  return sentryInstance;
}

export function getSentry(): D3VONNSentry {
  if (!sentryInstance) {
    sentryInstance = new D3VONNSentry(SENTRY_FRONTEND_CONFIG);
  }
  return sentryInstance;
}
