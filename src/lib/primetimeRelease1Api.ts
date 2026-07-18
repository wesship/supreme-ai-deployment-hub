import { supabase } from '@/integrations/supabase/client';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.d3vonn.io';

export type PrimetimeRecord = Record<string, unknown>;

export interface PrimetimeDashboard {
  workspaceId: string;
  userId: string;
  role: string;
  openLeads: PrimetimeRecord[];
  openTasks: PrimetimeRecord[];
  exceptions: PrimetimeRecord[];
  summary: {
    openLeadCount: number;
    openTaskCount: number;
    exceptionCount: number;
  };
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function primetimeFetch<T>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}${path}`, { headers });
  if (!response.ok) {
    const message = await response.text().catch(() => 'Unknown API error');
    throw new Error(`PRIMETIME API error ${response.status}: ${message}`);
  }
  return response.json();
}

function query(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).length > 0) {
      search.set(key, String(value));
    }
  }
  return search.toString();
}

export const primetimeRelease1Api = {
  listWorkspaces: () => primetimeFetch<PrimetimeRecord[]>('/primetime/v1/workspaces'),
  getDailyDashboard: (workspaceId: string) =>
    primetimeFetch<PrimetimeDashboard>(`/primetime/v1/dashboard/daily?${query({ workspace_id: workspaceId })}`),
  listPeople: (workspaceId: string, q?: string) =>
    primetimeFetch<PrimetimeRecord[]>(`/primetime/v1/people?${query({ workspace_id: workspaceId, q })}`),
  findDuplicatePeople: (workspaceId: string, email?: string, phone?: string) =>
    primetimeFetch<PrimetimeRecord[]>(`/primetime/v1/people/duplicates?${query({ workspace_id: workspaceId, email, phone })}`),
  listLeads: (workspaceId: string, status = 'open') =>
    primetimeFetch<PrimetimeRecord[]>(`/primetime/v1/leads?${query({ workspace_id: workspaceId, status })}`),
  listPipelineStages: (workspaceId: string) =>
    primetimeFetch<PrimetimeRecord[]>(`/primetime/v1/pipeline-stages?${query({ workspace_id: workspaceId })}`),
  listExceptions: (workspaceId: string, status = 'open') =>
    primetimeFetch<PrimetimeRecord[]>(`/primetime/v1/exceptions?${query({ workspace_id: workspaceId, status })}`),
};
