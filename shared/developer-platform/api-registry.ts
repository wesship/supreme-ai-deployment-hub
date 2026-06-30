/**
 * D3VONN Developer Platform — API Registry
 *
 * Centralized API registry with versioning, rate limiting,
 * documentation generation, and usage tracking.
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type AuthType = "api_key" | "oauth2" | "jwt" | "none";
export type ApiStatus = "active" | "deprecated" | "beta" | "internal";

export interface ApiEndpoint {
  id: string;
  path: string;
  method: HttpMethod;
  version: string;
  name: string;
  description: string;
  auth: AuthType;
  rateLimit: RateLimit;
  request: ApiSchema;
  response: ApiSchema;
  status: ApiStatus;
  tags: string[];
  examples: ApiExample[];
}

export interface RateLimit {
  requests: number;
  window: number; // seconds
  burstLimit?: number;
  tierOverrides?: Record<string, { requests: number; window: number }>;
}

export interface ApiSchema {
  contentType: string;
  fields: SchemaField[];
}

export interface SchemaField {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  required: boolean;
  description: string;
  example?: unknown;
  validation?: string;
  children?: SchemaField[];
}

export interface ApiExample {
  name: string;
  description: string;
  request: { headers?: Record<string, string>; body?: unknown; query?: Record<string, string> };
  response: { status: number; body: unknown };
}

export interface ApiKey {
  id: string;
  tenantId: string;
  name: string;
  key: string;
  prefix: string;
  permissions: string[];
  rateLimit: RateLimit;
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
  active: boolean;
}

export interface ApiUsage {
  keyId: string;
  endpoint: string;
  method: HttpMethod;
  statusCode: number;
  latency: number; // ms
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────
// API Registry
// ─────────────────────────────────────────────────────────────────

export class ApiRegistry {
  private endpoints: Map<string, ApiEndpoint> = new Map();
  private apiKeys: Map<string, ApiKey> = new Map();
  private usage: ApiUsage[] = [];
  private rateLimitCounters: Map<string, { count: number; resetAt: number }> = new Map();

  // ─── Endpoint Management ────────────────────────────────────

  registerEndpoint(endpoint: ApiEndpoint): void {
    const key = `${endpoint.method}:${endpoint.version}:${endpoint.path}`;
    this.endpoints.set(key, endpoint);
  }

  getEndpoint(method: HttpMethod, path: string, version: string): ApiEndpoint | undefined {
    return this.endpoints.get(`${method}:${version}:${path}`);
  }

  listEndpoints(version?: string, tag?: string, status?: ApiStatus): ApiEndpoint[] {
    let endpoints = [...this.endpoints.values()];
    if (version) endpoints = endpoints.filter((e) => e.version === version);
    if (tag) endpoints = endpoints.filter((e) => e.tags.includes(tag));
    if (status) endpoints = endpoints.filter((e) => e.status === status);
    return endpoints;
  }

  deprecateEndpoint(method: HttpMethod, path: string, version: string): boolean {
    const key = `${method}:${version}:${path}`;
    const endpoint = this.endpoints.get(key);
    if (!endpoint) return false;
    endpoint.status = "deprecated";
    return true;
  }

  // ─── API Key Management ─────────────────────────────────────

  createApiKey(tenantId: string, name: string, permissions: string[], expiresAt?: string): ApiKey {
    const id = `key_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const key = `d3v_${this.generateSecureKey(32)}`;
    const prefix = key.slice(0, 8);

    const apiKey: ApiKey = {
      id,
      tenantId,
      name,
      key,
      prefix,
      permissions,
      rateLimit: { requests: 1000, window: 3600 },
      createdAt: new Date().toISOString(),
      expiresAt,
      active: true,
    };

    this.apiKeys.set(id, apiKey);
    return apiKey;
  }

  validateApiKey(key: string): ApiKey | null {
    for (const apiKey of this.apiKeys.values()) {
      if (apiKey.key === key && apiKey.active) {
        if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
          apiKey.active = false;
          return null;
        }
        apiKey.lastUsedAt = new Date().toISOString();
        return apiKey;
      }
    }
    return null;
  }

  revokeApiKey(keyId: string): boolean {
    const key = this.apiKeys.get(keyId);
    if (!key) return false;
    key.active = false;
    return true;
  }

  listApiKeys(tenantId: string): ApiKey[] {
    return [...this.apiKeys.values()].filter((k) => k.tenantId === tenantId);
  }

  // ─── Rate Limiting ──────────────────────────────────────────

  checkRateLimit(keyId: string, endpoint: ApiEndpoint): { allowed: boolean; remaining: number; resetAt: number } {
    const counterKey = `${keyId}:${endpoint.id}`;
    const now = Date.now();
    const counter = this.rateLimitCounters.get(counterKey);

    if (!counter || now > counter.resetAt) {
      this.rateLimitCounters.set(counterKey, { count: 1, resetAt: now + endpoint.rateLimit.window * 1000 });
      return { allowed: true, remaining: endpoint.rateLimit.requests - 1, resetAt: now + endpoint.rateLimit.window * 1000 };
    }

    if (counter.count >= endpoint.rateLimit.requests) {
      return { allowed: false, remaining: 0, resetAt: counter.resetAt };
    }

    counter.count++;
    return { allowed: true, remaining: endpoint.rateLimit.requests - counter.count, resetAt: counter.resetAt };
  }

  // ─── Usage Tracking ─────────────────────────────────────────

  recordUsage(keyId: string, endpoint: string, method: HttpMethod, statusCode: number, latency: number): void {
    this.usage.push({ keyId, endpoint, method, statusCode, latency, timestamp: new Date().toISOString() });
  }

  getUsageStats(keyId: string, hours = 24): { totalRequests: number; avgLatency: number; errorRate: number; topEndpoints: { endpoint: string; count: number }[] } {
    const since = new Date(Date.now() - hours * 3600000).toISOString();
    const records = this.usage.filter((u) => u.keyId === keyId && u.timestamp >= since);

    const totalRequests = records.length;
    const avgLatency = totalRequests > 0 ? records.reduce((sum, r) => sum + r.latency, 0) / totalRequests : 0;
    const errors = records.filter((r) => r.statusCode >= 400).length;
    const errorRate = totalRequests > 0 ? errors / totalRequests : 0;

    const endpointCounts: Record<string, number> = {};
    for (const r of records) {
      endpointCounts[r.endpoint] = (endpointCounts[r.endpoint] ?? 0) + 1;
    }
    const topEndpoints = Object.entries(endpointCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([endpoint, count]) => ({ endpoint, count }));

    return { totalRequests, avgLatency: Math.round(avgLatency), errorRate, topEndpoints };
  }

  // ─── Documentation Generation ──────────────────────────────

  generateOpenApiSpec(version: string): Record<string, unknown> {
    const endpoints = this.listEndpoints(version);
    const paths: Record<string, unknown> = {};

    for (const ep of endpoints) {
      if (!paths[ep.path]) paths[ep.path] = {};
      (paths[ep.path] as Record<string, unknown>)[ep.method.toLowerCase()] = {
        summary: ep.name,
        description: ep.description,
        tags: ep.tags,
        parameters: ep.request.fields.filter((f) => f.required).map((f) => ({
          name: f.name,
          in: "body",
          required: f.required,
          schema: { type: f.type },
          description: f.description,
        })),
        responses: {
          "200": { description: "Success", content: { [ep.response.contentType]: {} } },
          "401": { description: "Unauthorized" },
          "429": { description: "Rate limit exceeded" },
        },
      };
    }

    return {
      openapi: "3.0.3",
      info: { title: "D3VONN Platform API", version, description: "D3VONN AI Orchestration Platform API" },
      servers: [{ url: "https://api.d3vonn.io" }],
      paths,
      components: { securitySchemes: { apiKey: { type: "apiKey", in: "header", name: "X-API-Key" } } },
    };
  }

  // ─── Helpers ────────────────────────────────────────────────

  private generateSecureKey(length: number): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

export function createApiRegistry(): ApiRegistry {
  return new ApiRegistry();
}
