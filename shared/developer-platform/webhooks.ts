/**
 * D3VONN Developer Platform — Webhooks
 *
 * Outbound webhook delivery with retry logic, signature verification,
 * event filtering, and delivery tracking.
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type WebhookStatus = "active" | "paused" | "disabled" | "failing";
export type DeliveryStatus = "pending" | "delivered" | "failed" | "retrying";

export interface WebhookEndpoint {
  id: string;
  tenantId: string;
  url: string;
  name: string;
  description: string;
  secret: string;
  events: string[];
  status: WebhookStatus;
  headers: Record<string, string>;
  retryPolicy: RetryPolicy;
  createdAt: string;
  updatedAt: string;
  lastDeliveredAt?: string;
  failureCount: number;
  maxFailures: number;
}

export interface RetryPolicy {
  maxRetries: number;
  initialDelay: number; // ms
  backoffMultiplier: number;
  maxDelay: number; // ms
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: unknown;
  status: DeliveryStatus;
  attempts: DeliveryAttempt[];
  createdAt: string;
  completedAt?: string;
}

export interface DeliveryAttempt {
  attemptNumber: number;
  timestamp: string;
  statusCode?: number;
  responseBody?: string;
  latency?: number; // ms
  error?: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  tenantId: string;
  data: unknown;
  timestamp: string;
  source: string;
}

export interface WebhookStats {
  webhookId: string;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  avgLatency: number;
  successRate: number;
  lastDelivery?: WebhookDelivery;
}

// ─────────────────────────────────────────────────────────────────
// Webhook Manager
// ─────────────────────────────────────────────────────────────────

export class WebhookManager {
  private endpoints: Map<string, WebhookEndpoint> = new Map();
  private deliveries: WebhookDelivery[] = [];
  private eventQueue: WebhookEvent[] = [];

  // ─── Endpoint Management ────────────────────────────────────

  createEndpoint(endpoint: Omit<WebhookEndpoint, "id" | "createdAt" | "updatedAt" | "failureCount" | "secret">): WebhookEndpoint {
    const id = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const secret = `whsec_${this.generateSecret(32)}`;

    const fullEndpoint: WebhookEndpoint = {
      ...endpoint,
      id,
      secret,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      failureCount: 0,
    };

    this.endpoints.set(id, fullEndpoint);
    return fullEndpoint;
  }

  getEndpoint(webhookId: string): WebhookEndpoint | undefined {
    return this.endpoints.get(webhookId);
  }

  listEndpoints(tenantId: string): WebhookEndpoint[] {
    return [...this.endpoints.values()].filter((e) => e.tenantId === tenantId);
  }

  updateEndpoint(webhookId: string, updates: Partial<WebhookEndpoint>): WebhookEndpoint | null {
    const endpoint = this.endpoints.get(webhookId);
    if (!endpoint) return null;
    Object.assign(endpoint, updates, { updatedAt: new Date().toISOString() });
    return endpoint;
  }

  deleteEndpoint(webhookId: string): boolean {
    return this.endpoints.delete(webhookId);
  }

  pauseEndpoint(webhookId: string): boolean {
    const endpoint = this.endpoints.get(webhookId);
    if (!endpoint) return false;
    endpoint.status = "paused";
    return true;
  }

  resumeEndpoint(webhookId: string): boolean {
    const endpoint = this.endpoints.get(webhookId);
    if (!endpoint) return false;
    endpoint.status = "active";
    endpoint.failureCount = 0;
    return true;
  }

  // ─── Event Dispatch ─────────────────────────────────────────

  dispatch(event: WebhookEvent): WebhookDelivery[] {
    const deliveries: WebhookDelivery[] = [];
    const matchingEndpoints = [...this.endpoints.values()]
      .filter((ep) => ep.tenantId === event.tenantId && ep.status === "active" && ep.events.includes(event.type));

    for (const endpoint of matchingEndpoints) {
      const delivery = this.createDelivery(endpoint, event);
      deliveries.push(delivery);
    }

    return deliveries;
  }

  private createDelivery(endpoint: WebhookEndpoint, event: WebhookEvent): WebhookDelivery {
    const delivery: WebhookDelivery = {
      id: `del_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      webhookId: endpoint.id,
      event: event.type,
      payload: this.buildPayload(event, endpoint),
      status: "pending",
      attempts: [],
      createdAt: new Date().toISOString(),
    };

    // Simulate delivery attempt
    const attempt = this.attemptDelivery(endpoint, delivery);
    delivery.attempts.push(attempt);

    if (attempt.statusCode && attempt.statusCode >= 200 && attempt.statusCode < 300) {
      delivery.status = "delivered";
      delivery.completedAt = new Date().toISOString();
      endpoint.lastDeliveredAt = delivery.completedAt;
      endpoint.failureCount = 0;
    } else {
      delivery.status = delivery.attempts.length < endpoint.retryPolicy.maxRetries ? "retrying" : "failed";
      endpoint.failureCount++;
      if (endpoint.failureCount >= endpoint.maxFailures) {
        endpoint.status = "failing";
      }
    }

    this.deliveries.push(delivery);
    return delivery;
  }

  private attemptDelivery(endpoint: WebhookEndpoint, _delivery: WebhookDelivery): DeliveryAttempt {
    // Simulated delivery — in production this makes HTTP POST
    return {
      attemptNumber: 1,
      timestamp: new Date().toISOString(),
      statusCode: 200,
      responseBody: '{"received": true}',
      latency: Math.floor(Math.random() * 500) + 50,
    };
  }

  private buildPayload(event: WebhookEvent, _endpoint: WebhookEndpoint): unknown {
    return {
      id: event.id,
      type: event.type,
      data: event.data,
      timestamp: event.timestamp,
      source: event.source,
      api_version: "2024-01-01",
    };
  }

  // ─── Signature Verification ─────────────────────────────────

  generateSignature(payload: string, secret: string): string {
    // Simplified HMAC — production uses crypto.createHmac('sha256', secret)
    let hash = 0;
    const combined = `${secret}:${payload}`;
    for (let i = 0; i < combined.length; i++) {
      hash = ((hash << 5) - hash) + combined.charCodeAt(i);
      hash = hash & hash;
    }
    return `v1=${Math.abs(hash).toString(16)}`;
  }

  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expected = this.generateSignature(payload, secret);
    return signature === expected;
  }

  // ─── Delivery History ───────────────────────────────────────

  getDeliveries(webhookId: string, limit = 50): WebhookDelivery[] {
    return this.deliveries.filter((d) => d.webhookId === webhookId).slice(-limit);
  }

  getStats(webhookId: string): WebhookStats {
    const deliveries = this.deliveries.filter((d) => d.webhookId === webhookId);
    const successful = deliveries.filter((d) => d.status === "delivered");
    const failed = deliveries.filter((d) => d.status === "failed");
    const latencies = deliveries.flatMap((d) => d.attempts.filter((a) => a.latency).map((a) => a.latency!));
    const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

    return {
      webhookId,
      totalDeliveries: deliveries.length,
      successfulDeliveries: successful.length,
      failedDeliveries: failed.length,
      avgLatency: Math.round(avgLatency),
      successRate: deliveries.length > 0 ? successful.length / deliveries.length : 0,
      lastDelivery: deliveries[deliveries.length - 1],
    };
  }

  // ─── Retry ──────────────────────────────────────────────────

  retryDelivery(deliveryId: string): WebhookDelivery | null {
    const delivery = this.deliveries.find((d) => d.id === deliveryId);
    if (!delivery || delivery.status === "delivered") return null;

    const endpoint = this.endpoints.get(delivery.webhookId);
    if (!endpoint) return null;

    const attempt = this.attemptDelivery(endpoint, delivery);
    delivery.attempts.push(attempt);

    if (attempt.statusCode && attempt.statusCode >= 200 && attempt.statusCode < 300) {
      delivery.status = "delivered";
      delivery.completedAt = new Date().toISOString();
    }

    return delivery;
  }

  // ─── Helpers ────────────────────────────────────────────────

  private generateSecret(length: number): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

export function createWebhookManager(): WebhookManager {
  return new WebhookManager();
}
