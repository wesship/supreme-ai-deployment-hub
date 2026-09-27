import { supabase } from '@/integrations/supabase/client';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export type SceneFinderHit = {
  video_id?: string;
  asset_id?: string;
  start?: number;
  end?: number;
  score?: number;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

export type SceneSearchResponse = {
  provider: string;
  surface: string;
  query: string;
  count: number;
  scenes: SceneFinderHit[];
};

export type SceneBlueprintResponse = {
  provider: string;
  surface: string;
  asset_id: string;
  objective: string;
  window: { start_time: number | null; end_time: number | null };
  result: unknown;
};

async function authenticatedPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error('Sign in to use Scene Finder.');
  const response = await fetch(`${API_BASE_URL}/api/ai-films/scene-finder/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let message = 'Scene Finder request failed.';
    try {
      const payload = await response.json();
      if (typeof payload?.detail === 'string') message = payload.detail;
    } catch {
      // Keep stable user-facing error.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function searchScenes(query: string): Promise<SceneSearchResponse> {
  return authenticatedPost<SceneSearchResponse>('search', { query, page_limit: 12 });
}

export async function createSceneBlueprint(input: {
  assetId: string;
  objective: string;
  startTime?: number;
  endTime?: number;
}): Promise<SceneBlueprintResponse> {
  return authenticatedPost<SceneBlueprintResponse>('blueprint', {
    asset_id: input.assetId,
    objective: input.objective,
    start_time: input.startTime ?? null,
    end_time: input.endTime ?? null,
  });
}
