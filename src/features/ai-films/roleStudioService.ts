import { supabase } from '@/integrations/supabase/client';
import { API_BASE_URL } from '@/services/config';

export type FilmRole = 'teacher' | 'instructor' | 'radio_dj' | 'host' | 'support';
export type RoleProfile = {
  avatar_version: string;
  voice_version: string;
  introduction: string;
  sources: string[];
  tools: string[];
  memory_scope: 'none' | 'session' | 'course';
  handoff: string;
};
export type RoleDraft = {
  revision: number;
  status: 'draft' | 'review' | 'approved' | 'published';
  profile: RoleProfile;
  profile_hash: string;
  tested_hash: string | null;
  editor_id: string;
  reviewer_id: string | null;
  published_version: number;
};
type Transition = { status: string; revision: number; version?: number };

async function roleApi<T>(projectId: string, role: FilmRole, suffix: string, init: RequestInit = {}): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error('Sign in to manage AI Films roles.');
  const response = await fetch(`${API_BASE_URL}/api/ai-films/roles/${encodeURIComponent(projectId)}/${role}/${suffix}`, {
    ...init,
    headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = typeof body.detail === 'string' ? body.detail : `Role Studio request failed (${response.status}).`;
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

export async function fetchRoleDraft(projectId: string, role: FilmRole): Promise<RoleDraft | null> {
  try {
    return await roleApi<RoleDraft>(projectId, role, 'draft');
  } catch (error) {
    if (error instanceof Error && error.message === 'Role draft is unavailable') return null;
    throw error;
  }
}

export function saveRoleDraft(projectId: string, role: FilmRole, expectedRevision: number, profile: RoleProfile) {
  return roleApi<Transition>(projectId, role, 'draft', {
    method: 'PUT', body: JSON.stringify({ expected_revision: expectedRevision, profile }),
  });
}

export async function policyTestRole(projectId: string, role: FilmRole, revision: number, profile: RoleProfile) {
  const result = await roleApi<{ attestation: string }>(projectId, role, 'policy-check', {
    method: 'POST', body: JSON.stringify({ revision, profile }),
  });
  return roleApi<Transition>(projectId, role, 'test', {
    method: 'POST', body: JSON.stringify({ revision, attestation: result.attestation }),
  });
}

export function transitionRole(projectId: string, role: FilmRole, revision: number, action: 'submit-review' | 'approve' | 'publish') {
  return roleApi<Transition>(projectId, role, action, {
    method: 'POST', body: JSON.stringify({ revision }),
  });
}
