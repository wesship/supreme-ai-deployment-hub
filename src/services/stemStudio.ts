import { API_BASE_URL } from './config';

export type StemMode = 'vocals' | 'four_stems';
export interface StemJob {
  id: string;
  mode: StemMode;
  status: 'uploading' | 'queued' | 'processing' | 'completed' | 'failed';
  error: string | null;
  stems: string[];
}

export async function stemRequest(path: string, init: RequestInit = {}) {
  const { supabase } = await import('@/integrations/supabase/client');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sign in to use Stem Studio.');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);
  const response = await fetch(`${API_BASE_URL}/api/music/stems${path}`, { ...init, headers });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(typeof error?.detail === 'string' ? error.detail : `Stem Studio request failed (${response.status}).`);
  }
  return response;
}

export async function createStemJob(file: File, mode: StemMode): Promise<StemJob> {
  const body = new FormData();
  body.append('file', file);
  body.append('mode', mode);
  body.append('rights_confirmed', 'true');
  return (await stemRequest('/jobs', { method: 'POST', body })).json();
}

export async function getStemJob(id: string, signal?: AbortSignal): Promise<StemJob> {
  return (await stemRequest(`/jobs/${encodeURIComponent(id)}`, { signal })).json();
}
