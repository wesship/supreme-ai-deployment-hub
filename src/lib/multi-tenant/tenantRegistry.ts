/**
 * Multi-Tenant API Layer — Tenant Registry and API Key Manager
 *
 * Manages tenant lifecycle, API key issuance, and key validation.
 * In production, this would be backed by a database (Supabase/Postgres).
 * This implementation uses an in-memory store for testability.
 */

import {
  Tenant,
  TenantTier,
  TenantStatus,
  ApiKey,
  ApiKeyCreateRequest,
  ApiKeyCreateResponse,
  ApiKeyScope,
  ApiKeyStatus,
} from "./types.js";

const TIER_DEFAULTS: Record<TenantTier, Tenant["quotas"] & Tenant["settings"]> = {
  free: {
    requestsPerDay: 100,
    requestsPerMinute: 5,
    maxTokensPerRequest: 4096,
    maxAgentsPerExecution: 1,
    storageGb: 1,
    allowedModels: ["gpt-4.1-nano"],
    maxConcurrentAgents: 1,
    dataRetentionDays: 7,
  },
  pro: {
    requestsPerDay: 10_000,
    requestsPerMinute: 60,
    maxTokensPerRequest: 32_768,
    maxAgentsPerExecution: 5,
    storageGb: 50,
    allowedModels: ["gpt-4.1-nano", "gpt-4.1-mini", "gemini-2.5-flash"],
    maxConcurrentAgents: 5,
    dataRetentionDays: 30,
  },
  enterprise: {
    requestsPerDay: 1_000_000,
    requestsPerMinute: 1_000,
    maxTokensPerRequest: 128_000,
    maxAgentsPerExecution: 50,
    storageGb: 1_000,
    allowedModels: ["*"],
    maxConcurrentAgents: 50,
    dataRetentionDays: 365,
  },
};

function secureRandomHex(byteLength: number): string {
  const webCrypto = globalThis.crypto;
  if (!webCrypto?.getRandomValues) {
    throw new Error("Secure random number generation is unavailable");
  }
  const bytes = new Uint8Array(byteLength);
  webCrypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function generateId(): string {
  return secureRandomHex(12);
}

function generateRawApiKey(tier: TenantTier): string {
  const prefix = tier === "enterprise" ? "dvn_ent_" : tier === "pro" ? "dvn_pro_" : "dvn_free_";
  return `${prefix}${secureRandomHex(20)}`;
}

async function hashApiKey(rawKey: string): Promise<string> {
  const webCrypto = globalThis.crypto;
  if (!webCrypto?.subtle) {
    throw new Error("Web Crypto hashing is unavailable");
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(rawKey);
  const hashBuffer = await webCrypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class TenantRegistry {
  private tenants: Map<string, Tenant> = new Map();
  private apiKeys: Map<string, ApiKey> = new Map();
  private keyHashIndex: Map<string, string> = new Map();

  createTenant(name: string, tier: TenantTier = "free"): Tenant {
    const defaults = TIER_DEFAULTS[tier];
    const tenant: Tenant = {
      id: generateId(),
      name,
      tier,
      status: "active" as TenantStatus,
      createdAt: new Date(),
      updatedAt: new Date(),
      settings: {
        allowedModels: defaults.allowedModels,
        maxConcurrentAgents: defaults.maxConcurrentAgents,
        dataRetentionDays: defaults.dataRetentionDays,
      },
      quotas: {
        requestsPerDay: defaults.requestsPerDay,
        requestsPerMinute: defaults.requestsPerMinute,
        maxTokensPerRequest: defaults.maxTokensPerRequest,
        maxAgentsPerExecution: defaults.maxAgentsPerExecution,
        storageGb: defaults.storageGb,
      },
    };
    this.tenants.set(tenant.id, tenant);
    return tenant;
  }

  getTenant(tenantId: string): Tenant | undefined {
    return this.tenants.get(tenantId);
  }

  updateTenantStatus(tenantId: string, status: TenantStatus): boolean {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return false;
    tenant.status = status;
    tenant.updatedAt = new Date();
    return true;
  }

  upgradeTier(tenantId: string, newTier: TenantTier): boolean {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return false;
    const defaults = TIER_DEFAULTS[newTier];
    tenant.tier = newTier;
    tenant.quotas = {
      requestsPerDay: defaults.requestsPerDay,
      requestsPerMinute: defaults.requestsPerMinute,
      maxTokensPerRequest: defaults.maxTokensPerRequest,
      maxAgentsPerExecution: defaults.maxAgentsPerExecution,
      storageGb: defaults.storageGb,
    };
    tenant.settings.allowedModels = defaults.allowedModels;
    tenant.settings.maxConcurrentAgents = defaults.maxConcurrentAgents;
    tenant.updatedAt = new Date();
    return true;
  }

  async issueApiKey(request: ApiKeyCreateRequest): Promise<ApiKeyCreateResponse> {
    const tenant = this.tenants.get(request.tenantId);
    if (!tenant) throw new Error(`Tenant not found: ${request.tenantId}`);
    if (tenant.status !== "active") throw new Error(`Tenant is ${tenant.status}`);

    const rawKey = generateRawApiKey(tenant.tier);
    const keyHash = await hashApiKey(rawKey);
    const prefix = rawKey.substring(0, rawKey.indexOf("_", 4) + 1 + 4);

    const expiresAt = request.expiresInDays
      ? new Date(Date.now() + request.expiresInDays * 86_400_000)
      : undefined;

    const apiKey: ApiKey = {
      id: generateId(),
      tenantId: request.tenantId,
      name: request.name,
      keyHash,
      prefix,
      scopes: request.scopes,
      status: "active" as ApiKeyStatus,
      createdAt: new Date(),
      expiresAt,
      usageCount: 0,
    };

    this.apiKeys.set(apiKey.id, apiKey);
    this.keyHashIndex.set(keyHash, apiKey.id);

    return { apiKey, rawKey };
  }

  async validateApiKey(rawKey: string): Promise<ApiKey | null> {
    const keyHash = await hashApiKey(rawKey);
    const keyId = this.keyHashIndex.get(keyHash);
    if (!keyId) return null;

    const apiKey = this.apiKeys.get(keyId);
    if (!apiKey) return null;
    if (apiKey.status !== "active") return null;
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      apiKey.status = "expired";
      return null;
    }

    apiKey.lastUsedAt = new Date();
    apiKey.usageCount++;
    return apiKey;
  }

  revokeApiKey(keyId: string): boolean {
    const apiKey = this.apiKeys.get(keyId);
    if (!apiKey) return false;
    apiKey.status = "revoked";
    return true;
  }

  getApiKeysForTenant(tenantId: string): ApiKey[] {
    return Array.from(this.apiKeys.values()).filter((k) => k.tenantId === tenantId);
  }

  hasScope(apiKey: ApiKey, requiredScope: ApiKeyScope): boolean {
    if (apiKey.scopes.includes("admin")) return true;
    return apiKey.scopes.includes(requiredScope);
  }

  get tenantCount(): number {
    return this.tenants.size;
  }

  get apiKeyCount(): number {
    return this.apiKeys.size;
  }
}
