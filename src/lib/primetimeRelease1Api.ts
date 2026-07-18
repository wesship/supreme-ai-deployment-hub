import { supabase } from '@/integrations/supabase/client';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.d3vonn.io';

export type PrimetimeRecord = Record<string, unknown>;
export type PrimetimePayload = Record<string, unknown>;

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
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'Content-Type': 'application/json',
  };
}

async function primetimeFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}${path}`, { ...init, headers: { ...headers, ...(init?.headers || {}) } });
  if (!response.ok) {
    const message = await response.text().catch(() => 'Unknown API error');
    throw new Error(`PRIMETIME API error ${response.status}: ${message}`);
  }
  return response.json();
}

function post<T>(path: string, payload: PrimetimePayload): Promise<T> {
  return primetimeFetch<T>(path, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

function patch<T>(path: string, payload: PrimetimePayload): Promise<T> {
  return primetimeFetch<T>(path, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
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
  createPerson: (payload: PrimetimePayload) => post<PrimetimeRecord>('/primetime/v1/people', payload),
  createLead: (payload: PrimetimePayload) => post<PrimetimeRecord>('/primetime/v1/leads', payload),
  updateLead: (leadId: string, payload: PrimetimePayload) => patch<PrimetimeRecord>(`/primetime/v1/leads/${leadId}`, payload),
  createTask: (payload: PrimetimePayload) => post<PrimetimeRecord>('/primetime/v1/tasks', payload),
  createActivity: (payload: PrimetimePayload) => post<PrimetimeRecord>('/primetime/v1/activities', payload),
  recordConsent: (payload: PrimetimePayload) => post<PrimetimeRecord>('/primetime/v1/consent-records', payload),
  createSuppressionRecord: (payload: PrimetimePayload) => post<PrimetimeRecord>('/primetime/v1/suppression-records', payload),

  listAppointments: (workspaceId: string, status?: string) =>
    primetimeFetch<PrimetimeRecord[]>(`/primetime/v1/appointments?${query({ workspace_id: workspaceId, status })}`),
  createAppointment: (payload: PrimetimePayload) => post<PrimetimeRecord>('/primetime/v1/appointments', payload),
  updateAppointment: (appointmentId: string, payload: PrimetimePayload) =>
    patch<PrimetimeRecord>(`/primetime/v1/appointments/${appointmentId}`, payload),
  listAvailabilityRules: (workspaceId: string) =>
    primetimeFetch<PrimetimeRecord[]>(`/primetime/v1/availability-rules?${query({ workspace_id: workspaceId })}`),
  createAvailabilityRule: (payload: PrimetimePayload) => post<PrimetimeRecord>('/primetime/v1/availability-rules', payload),
  createAppointmentAttendee: (payload: PrimetimePayload) => post<PrimetimeRecord>('/primetime/v1/appointment-attendees', payload),
  listReminders: (workspaceId: string, status = 'pending') =>
    primetimeFetch<PrimetimeRecord[]>(`/primetime/v1/reminders?${query({ workspace_id: workspaceId, status })}`),
  createReminder: (payload: PrimetimePayload) => post<PrimetimeRecord>('/primetime/v1/reminders', payload),
  listNoShowEvents: (workspaceId: string) =>
    primetimeFetch<PrimetimeRecord[]>(`/primetime/v1/no-show-events?${query({ workspace_id: workspaceId })}`),
  createCalendarSyncEvent: (payload: PrimetimePayload) => post<PrimetimeRecord>('/primetime/v1/calendar-sync-events', payload),

  listMessageTemplates: (workspaceId: string, status?: string) =>
    primetimeFetch<PrimetimeRecord[]>(`/primetime/v1/message-templates?${query({ workspace_id: workspaceId, status })}`),
  createMessageTemplate: (payload: PrimetimePayload) => post<PrimetimeRecord>('/primetime/v1/message-templates', payload),
  updateMessageTemplate: (templateId: string, payload: PrimetimePayload) =>
    patch<PrimetimeRecord>(`/primetime/v1/message-templates/${templateId}`, payload),
  listMessageTemplateVersions: (workspaceId: string, templateId?: string) =>
    primetimeFetch<PrimetimeRecord[]>(`/primetime/v1/message-template-versions?${query({ workspace_id: workspaceId, template_id: templateId })}`),
  createMessageTemplateVersion: (payload: PrimetimePayload) => post<PrimetimeRecord>('/primetime/v1/message-template-versions', payload),
  listCommunicationPreferences: (workspaceId: string, personId?: string) =>
    primetimeFetch<PrimetimeRecord[]>(`/primetime/v1/communication-preferences?${query({ workspace_id: workspaceId, person_id: personId })}`),
  createCommunicationPreference: (payload: PrimetimePayload) => post<PrimetimeRecord>('/primetime/v1/communication-preferences', payload),
  listCommunications: (workspaceId: string, status?: string) =>
    primetimeFetch<PrimetimeRecord[]>(`/primetime/v1/communications?${query({ workspace_id: workspaceId, status })}`),
  createCommunication: (payload: PrimetimePayload) => post<PrimetimeRecord>('/primetime/v1/communications', payload),
  updateCommunication: (communicationId: string, payload: PrimetimePayload) =>
    patch<PrimetimeRecord>(`/primetime/v1/communications/${communicationId}`, payload),
  listCommunicationEvents: (workspaceId: string, communicationId?: string) =>
    primetimeFetch<PrimetimeRecord[]>(`/primetime/v1/communication-events?${query({ workspace_id: workspaceId, communication_id: communicationId })}`),
  createCommunicationEvent: (payload: PrimetimePayload) => post<PrimetimeRecord>('/primetime/v1/communication-events', payload),
  listCommunicationPolicyChecks: (workspaceId: string, communicationId?: string, status?: string) =>
    primetimeFetch<PrimetimeRecord[]>(`/primetime/v1/communication-policy-checks?${query({ workspace_id: workspaceId, communication_id: communicationId, status })}`),
  createCommunicationPolicyCheck: (payload: PrimetimePayload) => post<PrimetimeRecord>('/primetime/v1/communication-policy-checks', payload),
};