import { supabase } from '@/integrations/supabase/client';

export type OpenMontageStage = {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  updatedAt: string;
};

export type OpenMontageDispatchInput = {
  jobId: string;
  idea: string;
  screenplay: string;
  videoPrompt: string;
  durationSeconds?: number;
};

export type OpenMontageDispatch = {
  project_id: string;
  render_job_id: string;
  provider: string;
  status: string;
  stages: OpenMontageStage[];
};

export type OpenMontageJobStatus = {
  render_job_id: string;
  project_id: string;
  provider: string;
  provider_job_id?: string | null;
  status: string;
  stages: OpenMontageStage[];
  video_url?: string | null;
  review_state?: string | null;
  error?: string | null;
};

const apiBase = (import.meta.env.VITE_API_BASE_URL || 'https://api.d3vonn.io').replace(/\/$/, '');

async function authorizationHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in to create or track an AI Film render.');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function parseError(response: Response, fallback: string): Promise<never> {
  const payload = await response.json().catch(() => ({}));
  throw new Error(payload.detail || payload.message || fallback);
}

export async function dispatchOpenMontage(input: OpenMontageDispatchInput): Promise<OpenMontageDispatch> {
  const response = await fetch(`${apiBase}/api/ai-films/openmontage/dispatch`, {
    method: 'POST',
    headers: await authorizationHeaders(),
    body: JSON.stringify({
      job_id: input.jobId,
      idea: input.idea,
      screenplay: input.screenplay,
      video_prompt: input.videoPrompt,
      duration_seconds: input.durationSeconds ?? 8,
    }),
  });
  if (!response.ok) return parseError(response, 'OpenMontage could not queue the render.');
  return response.json();
}

export async function getOpenMontageJob(renderJobId: string): Promise<OpenMontageJobStatus> {
  const response = await fetch(`${apiBase}/api/ai-films/openmontage/jobs/${encodeURIComponent(renderJobId)}`, {
    headers: await authorizationHeaders(),
  });
  if (!response.ok) return parseError(response, 'OpenMontage render status could not be retrieved.');
  return response.json();
}
