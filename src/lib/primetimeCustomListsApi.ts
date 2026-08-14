import { supabase } from '@/integrations/supabase/client';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.d3vonn.io';

export interface PrimetimeCustomList {
  id: string;
  workspace_id: string;
  display_name: string;
  description: string;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  record_count: number;
}

export interface PrimetimeCustomListMember {
  id: string;
  workspace_id: string;
  custom_list_id: string;
  person_id: string;
  added_by: string;
  added_at: string;
  removed_by: string | null;
  removed_at: string | null;
}

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Authentication is required for PRIMETIME Custom Lists.');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers || {}) },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(payload?.detail || `PRIMETIME Custom Lists request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

function query(params: Record<string, string | boolean>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) search.set(key, String(value));
  return search.toString();
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

function patch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
}

export const primetimeCustomListsApi = {
  list: (workspaceId: string, includeArchived = false) =>
    request<PrimetimeCustomList[]>(`/primetime/v1/custom-lists?${query({ workspace_id: workspaceId, include_archived: includeArchived })}`),

  create: (payload: { workspace_id: string; display_name: string; description?: string }) =>
    post<PrimetimeCustomList>('/primetime/v1/custom-lists', payload),

  update: (listId: string, payload: { workspace_id: string; display_name?: string; description?: string }) =>
    patch<PrimetimeCustomList>(`/primetime/v1/custom-lists/${listId}`, payload),

  archive: (listId: string, workspaceId: string) =>
    post<PrimetimeCustomList>(`/primetime/v1/custom-lists/${listId}/archive`, { workspace_id: workspaceId }),

  listMembers: (listId: string, workspaceId: string) =>
    request<PrimetimeCustomListMember[]>(`/primetime/v1/custom-lists/${listId}/members?${query({ workspace_id: workspaceId })}`),

  addMember: (listId: string, workspaceId: string, personId: string) =>
    post<PrimetimeCustomListMember>(`/primetime/v1/custom-lists/${listId}/members`, {
      workspace_id: workspaceId,
      person_id: personId,
    }),

  removeMember: (listId: string, personId: string, workspaceId: string) =>
    post<PrimetimeCustomListMember>(`/primetime/v1/custom-lists/${listId}/members/${personId}/remove`, {
      workspace_id: workspaceId,
    }),
};
