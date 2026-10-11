import { supabase } from '@/integrations/supabase/client';
import { API_BASE_URL } from '@/services/config';
import { z } from 'zod';
import { isAvatarTemplate } from './catalog';
import type { WorkflowMetadata } from './workflowImport';

const uuid = z.string().uuid();
export const runtimeSchema = z.object({ authenticated: z.literal(true), handoff_enabled: z.boolean(), render_enabled: z.literal(false), live_enabled: z.literal(false), consent_verified: z.literal(false), blockers: z.array(z.string().max(500)).max(10) });
const projectSchema = z.object({ items: z.array(z.object({ id: uuid, title: z.string().max(1000) })).max(50), has_more: z.boolean() });
export const handoffSchema = z.object({ id: uuid, status: z.literal('draft'), execution: z.literal('blocked'), content_hash: z.string().regex(/^[a-f0-9]{64}$/), template: z.string(), blockers: z.array(z.string().max(500)).max(10) });
export type HandoffResult = z.infer<typeof handoffSchema>;
export type HandoffProject = z.infer<typeof projectSchema>['items'][number];

export function handoffPayload(metadata: WorkflowMetadata, requestId: string) {
  uuid.parse(requestId);
  if (!isAvatarTemplate(metadata.project.format)) throw new Error('Select a supported Studio workflow format.');
  const title = metadata.project.title.trim().slice(0, 160);
  if (!title) throw new Error('The imported plan needs a title.');
  // Deliberate projection: no source project IDs, hashes, content, job IDs or approvals.
  return { request_id: requestId, title, template: metadata.project.format,
    stage_claims: metadata.stages.map(({ stage, status }) => ({ stage, status })) };
}

export function handoffApiBase(value: string, currentOrigin: string, development: boolean) {
  const url = new URL(value || currentOrigin);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Invalid Studio API origin.');
  const trusted = ['https://api.d3vonn.io', 'https://staging-api.d3vonn.io', currentOrigin];
  if (!trusted.includes(url.origin) && !(development && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Studio API origin is not trusted.');
  if (url.protocol !== 'https:' && !(development && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Studio API requires HTTPS.');
  return url.origin;
}

async function request<T>(path: string, userId: string, schema: z.ZodType<T>, init: RequestInit = {}) {
  const base = handoffApiBase(API_BASE_URL, window.location.origin, import.meta.env.DEV);
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.user.id !== userId) throw new Error('Your account changed. Check the connection again.');
  const response = await fetch(`${base}/api/ai-films/avatar-studio/${path}`, { ...init, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20000),
    headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' } });
  if (!response.ok) throw new Error(response.status === 401 ? 'Sign in to D3VONN again.' : response.status === 404 ? 'Studio handoff is not enabled or this project is unavailable.' : response.status === 409 ? 'The handoff conflicts with a saved draft. Import it again.' : 'Studio handoff is unavailable. Nothing has been confirmed saved.');
  return schema.parse(await response.json());
}
export const checkHandoff = (userId: string) => request('status', userId, runtimeSchema);
export const ownedHandoffProjects = (userId: string) => request('projects', userId, projectSchema);
export const saveHandoff = (userId: string, projectId: string, metadata: WorkflowMetadata, requestId: string) => {
  uuid.parse(projectId);
  return request(`projects/${projectId}/handoffs`, userId, handoffSchema, { method: 'POST', body: JSON.stringify(handoffPayload(metadata, requestId)) });
};
