import { env } from '@/lib/env';
import { supabase } from '@/integrations/supabase/client';

export type DoorCapability = {
  provider: string;
  engine: string;
  role?: string;
  configured: boolean;
  mode: string;
  recommended_for?: string[];
};

export type DoorCapabilities = {
  subsystem: string;
  workflow: string[];
  engine_adapters: DoorCapability[];
  asset_pipeline: {
    provider: string;
    configured: boolean;
    mode: string;
    recommended_version?: string;
    operations?: string[];
    shared_consumers?: string[];
  };
};

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit, authenticated = false): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(authenticated ? await authHeaders() : {}),
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };
  const response = await fetch(`${env.apiUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `THE DOOR request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function getDoorHealth() {
  return request<Record<string, unknown>>('/api/the-door/health');
}

export function getDoorCapabilities() {
  return request<DoorCapabilities>('/api/the-door/capabilities');
}

export function executeDoorJob(payload: unknown) {
  return request('/api/the-door/jobs/execute', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, true);
}

export function verifyDoorJob(payload: unknown) {
  return request('/api/the-door/jobs/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, true);
}
