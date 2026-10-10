import { supabase } from '@/integrations/supabase/client';

const requireUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sign in is required to manage the enterprise studio.');
  return data.user;
};

export type Collaborator = {
  id: string;
  email: string | null;
  role: 'owner' | 'producer' | 'director' | 'writer' | 'editor' | 'reviewer' | 'viewer';
  status: string;
};

export type CommercialRelease = {
  id: string;
  title: string;
  releaseType: 'festival' | 'streaming' | 'theatrical' | 'broadcast' | 'direct' | 'licensing';
  territory: string;
  status: string;
  releaseDate: string | null;
};

export const inviteCollaborator = async (projectId: string, email: string, role: Collaborator['role']) => {
  const user = await requireUser();
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error('A collaborator email is required.');
  const { error } = await (supabase as any).from('ai_film_collaborators').upsert({
    project_id: projectId,
    owner_id: user.id,
    email: normalized,
    role,
    status: 'invited',
    permissions: { can_comment: role !== 'viewer', can_approve: ['owner','producer','director','reviewer'].includes(role) },
  }, { onConflict: 'project_id,email' });
  if (error) throw error;
  await recordActivity(projectId, 'collaborator_invited', 'collaborator', null, `${normalized} invited as ${role}.`);
};

export const fetchCollaborators = async (projectId: string): Promise<Collaborator[]> => {
  const user = await requireUser();
  const { data, error } = await (supabase as any)
    .from('ai_film_collaborators')
    .select('id,email,role,status')
    .eq('project_id', projectId)
    .eq('owner_id', user.id)
    .order('invited_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row: any) => ({ id: row.id, email: row.email, role: row.role, status: row.status }));
};

export const recordActivity = async (projectId: string, eventType: string, targetType: string | null, targetId: string | null, summary: string) => {
  const user = await requireUser();
  const { error } = await (supabase as any).from('ai_film_activity_events').insert({
    project_id: projectId,
    owner_id: user.id,
    actor_id: user.id,
    event_type: eventType,
    target_type: targetType,
    target_id: targetId,
    summary,
  });
  if (error) throw error;
};

export const createAnalyticsSnapshot = async (projectId: string, metrics: Record<string, number>) => {
  const user = await requireUser();
  const { error } = await (supabase as any).from('ai_film_analytics_snapshots').upsert({
    project_id: projectId,
    owner_id: user.id,
    snapshot_date: new Date().toISOString().slice(0, 10),
    metrics,
  }, { onConflict: 'project_id,snapshot_date' });
  if (error) throw error;
};

export const createCommercialRelease = async (
  projectId: string,
  title: string,
  releaseType: CommercialRelease['releaseType'],
  territory: string,
) => {
  const user = await requireUser();
  const { error } = await (supabase as any).from('ai_film_commercial_releases').insert({
    project_id: projectId,
    owner_id: user.id,
    title,
    release_type: releaseType,
    territory: territory || 'worldwide',
    rights_model: 'all-rights',
    status: 'planning',
    revenue_model: {},
    deliverables: [],
  });
  if (error) throw error;
  await recordActivity(projectId, 'commercial_release_created', 'commercial_release', null, `${title} commercial release plan created.`);
};

export const fetchCommercialReleases = async (projectId: string): Promise<CommercialRelease[]> => {
  const user = await requireUser();
  const { data, error } = await (supabase as any)
    .from('ai_film_commercial_releases')
    .select('id,title,release_type,territory,status,release_date')
    .eq('project_id', projectId)
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row: any) => ({ id: row.id, title: row.title, releaseType: row.release_type, territory: row.territory, status: row.status, releaseDate: row.release_date }));
};
