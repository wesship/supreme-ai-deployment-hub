import { supabase } from '@/integrations/supabase/client';
import { API_BASE_URL } from '@/services/config';

export type FilmRole = 'teacher' | 'instructor' | 'radio_dj' | 'host' | 'support';
export type FilmCharacter = { id: string; slug: string; name: string; description: string; avatar_version: string; status: 'active' | 'archived' };
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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error('Sign in to manage AI Films roles.');
  const response = await fetch(`${API_BASE_URL}/api/ai-films/${path}`, {
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

const characterPath = (projectId: string) => `projects/${encodeURIComponent(projectId)}/characters`;
const rolePath = (projectId: string, characterId: string, role: FilmRole) =>
  `${characterPath(projectId)}/${encodeURIComponent(characterId)}/roles/${role}`;

export const fetchCharacters = (projectId: string, page = 0) =>
  request<{ items: FilmCharacter[]; has_more: boolean }>(`${characterPath(projectId)}?page=${page}`);
export const createCharacter = (projectId: string, character: { name: string; slug: string; description: string; avatar_version: string }) =>
  request<FilmCharacter>(characterPath(projectId), { method: 'POST', body: JSON.stringify(character) });

export async function fetchRoleDraft(projectId: string, characterId: string, role: FilmRole): Promise<RoleDraft | null> {
  try {
    return await request<RoleDraft>(`${rolePath(projectId, characterId, role)}/draft`);
  } catch (error) {
    if (error instanceof Error && error.message === 'Role draft is unavailable') return null;
    throw error;
  }
}

export function saveRoleDraft(projectId: string, characterId: string, role: FilmRole, expectedRevision: number, profile: RoleProfile) {
  return request<Transition>(`${rolePath(projectId, characterId, role)}/draft`, {
    method: 'PUT', body: JSON.stringify({ expected_revision: expectedRevision, profile }),
  });
}

export async function policyTestRole(projectId: string, characterId: string, role: FilmRole, revision: number) {
  const result = await request<{ attestation: string }>(`${rolePath(projectId, characterId, role)}/policy-check`, {
    method: 'POST', body: JSON.stringify({ revision }),
  });
  return request<Transition>(`${rolePath(projectId, characterId, role)}/test`, {
    method: 'POST', body: JSON.stringify({ revision, attestation: result.attestation }),
  });
}

export function transitionRole(projectId: string, characterId: string, role: FilmRole, revision: number, action: 'submit-review' | 'approve' | 'publish') {
  return request<Transition>(`${rolePath(projectId, characterId, role)}/${action}`, {
    method: 'POST', body: JSON.stringify({ revision }),
  });
}

export function previewCharacterVoice(projectId: string, characterId: string, role: FilmRole) {
  return request<{ mode: 'character-voice-preview'; release_version: number; assistant: Record<string, unknown> }>(
    `${rolePath(projectId, characterId, role)}/voice-preview`, { method: 'POST' },
  );
}
