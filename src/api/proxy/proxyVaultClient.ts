/**
 * src/api/proxy/proxyVaultClient.ts
 *
 * Typed API client for the backend proxy-vault endpoints:
 *   GET    /api/proxy/config
 *   GET    /api/proxy/vault/keys
 *   POST   /api/proxy/vault/keys
 *   DELETE /api/proxy/vault/keys/:name
 *
 * All requests attach the Supabase session JWT automatically.
 * No real API key values are ever sent to or stored in the frontend.
 */

import { supabase } from '@/integrations/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProxyConfig {
  mode: 'env-first' | 'vault';
  status: 'active' | 'inactive';
  vaultPath: string;
  keysConfigured: number;
  vaultEncrypted: boolean;
}

export interface KeyListResponse {
  keys: string[];
  total: number;
}

export interface StoreKeyRequest {
  /** Key name — must match ^[A-Z0-9_]+$ */
  name: string;
  /** Key value — never logged or stored in frontend state */
  value: string;
}

export interface StoreKeyResponse {
  success: boolean;
  name: string;
  encrypted: boolean;
}

export type ProxyVaultError =
  | { code: 'UNAUTHORIZED'; message: string }
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'VALIDATION'; message: string }
  | { code: 'SERVER_ERROR'; message: string }
  | { code: 'NETWORK'; message: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body?.detail ?? detail;
    } catch {
      // ignore parse errors
    }
    const error: ProxyVaultError = (() => {
      switch (response.status) {
        case 401:
          return { code: 'UNAUTHORIZED', message: detail } as const;
        case 404:
          return { code: 'NOT_FOUND', message: detail } as const;
        case 422:
          return { code: 'VALIDATION', message: detail } as const;
        default:
          return { code: 'SERVER_ERROR', message: detail } as const;
      }
    })();
    throw error;
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch the current proxy/vault configuration metadata.
 * Does not return any key values.
 */
export async function getProxyConfig(): Promise<ProxyConfig> {
  return apiFetch<ProxyConfig>('/api/proxy/config');
}

/**
 * List the names of all keys stored in the vault.
 * Values are never returned by the API.
 */
export async function listVaultKeys(): Promise<KeyListResponse> {
  return apiFetch<KeyListResponse>('/api/proxy/vault/keys');
}

/**
 * Store or rotate an API key in the vault.
 * The `value` field is transmitted over TLS and immediately encrypted
 * server-side; it is not retained in frontend state after this call.
 */
export async function storeVaultKey(
  request: StoreKeyRequest
): Promise<StoreKeyResponse> {
  return apiFetch<StoreKeyResponse>('/api/proxy/vault/keys', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Remove a key from the vault by name.
 */
export async function deleteVaultKey(name: string): Promise<void> {
  return apiFetch<void>(`/api/proxy/vault/keys/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
}
