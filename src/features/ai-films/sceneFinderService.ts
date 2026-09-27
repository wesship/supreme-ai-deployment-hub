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

async function authenticatedApiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error('Sign in to use Scene Finder.');
  const response = await fetch(`${API_BASE_URL}${path}`, {
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
  return authenticatedApiPost<SceneSearchResponse>('/api/ai-films/scene-finder/search', { query, page_limit: 12 });
}

export async function createSceneBlueprint(input: {
  assetId: string;
  objective: string;
  startTime?: number;
  endTime?: number;
}): Promise<SceneBlueprintResponse> {
  return authenticatedApiPost<SceneBlueprintResponse>('/api/ai-films/scene-finder/blueprint', {
    asset_id: input.assetId,
    objective: input.objective,
    start_time: input.startTime ?? null,
    end_time: input.endTime ?? null,
  });
}


export type SceneProductionResponse = {
  status: string;
  surface: string;
  reference_asset_id: string;
  reference_window: { start_time: number | null; end_time: number | null };
  originality_policy: string;
  production: {
    project_id: string;
    render_job_id: string;
    render_job_ids?: string[];
    provider: string;
    provider_route?: string[];
    shot_count?: number;
    aspect_ratio?: string;
    status: string;
    stages?: Array<{ name: string; status: string; updatedAt?: string }>;
  };
};

export async function dispatchSceneProduction(input: {
  assetId: string;
  objective: string;
  startTime?: number;
  endTime?: number;
  durationSeconds?: number;
  aspectRatio?: '16:9' | '9:16' | '4:5';
}): Promise<SceneProductionResponse> {
  return authenticatedApiPost<SceneProductionResponse>('/api/ai-films/scene-finder/production-handoff', {
    asset_id: input.assetId,
    objective: input.objective,
    start_time: input.startTime ?? null,
    end_time: input.endTime ?? null,
    duration_seconds: input.durationSeconds ?? 8,
    aspect_ratio: input.aspectRatio ?? '16:9',
  });
}


export async function sendSceneToTimeline(input: {
  projectId: string;
  assetId: string;
  label: string;
  durationSeconds: number;
}): Promise<{ status: string; render_job: { id: string }; planned_runtime_seconds: number }> {
  return authenticatedApiPost('/api/ai-films/director/assemble', {
    project_id: input.projectId,
    title: input.label,
    clips: [{
      asset_id: input.assetId,
      label: input.label,
      duration_seconds: input.durationSeconds,
      source_in: 0,
      source_out: input.durationSeconds,
      tags: ['scene-finder', 'qa-approved'],
    }],
    structure: 'montage',
    target_runtime_seconds: input.durationSeconds,
    fps: 24,
    resolution: '1920x1080',
    aspect_ratio: '16:9',
    include_dialogue: true,
    include_music: true,
    include_sfx: true,
    include_subtitles: true,
    run_continuity_qa: true,
    run_final_analyze_qa: true,
  });
}


export type SceneFusionRole = 'camera' | 'lighting' | 'pacing' | 'sound' | 'production_design';

export type SceneFusionReferenceInput = {
  assetId: string;
  role: SceneFusionRole;
  startTime?: number;
  endTime?: number;
};

export type SceneFusionResponse = {
  status: string;
  surface: string;
  reference_count: number;
  reference_roles: SceneFusionRole[];
  originality_policy: string;
  production: SceneProductionResponse['production'];
};

export async function dispatchSceneFusion(input: {
  objective: string;
  references: SceneFusionReferenceInput[];
  durationSeconds?: number;
  aspectRatio?: '16:9' | '9:16' | '4:5';
}): Promise<SceneFusionResponse> {
  return authenticatedApiPost<SceneFusionResponse>('/api/ai-films/scene-finder/fusion-handoff', {
    objective: input.objective,
    references: input.references.map((reference) => ({
      asset_id: reference.assetId,
      role: reference.role,
      start_time: reference.startTime ?? null,
      end_time: reference.endTime ?? null,
    })),
    duration_seconds: input.durationSeconds ?? 8,
    aspect_ratio: input.aspectRatio ?? '16:9',
  });
}


export type TimelineClipInput = {
  assetId: string;
  label: string;
  durationSeconds: number;
};

export async function sendScenesToTimeline(input: {
  projectId: string;
  title: string;
  clips: TimelineClipInput[];
}): Promise<{ status: string; render_job: { id: string }; planned_runtime_seconds: number; timeline: unknown[] }> {
  const total = input.clips.reduce((sum, clip) => sum + clip.durationSeconds, 0);
  return authenticatedApiPost('/api/ai-films/director/assemble', {
    project_id: input.projectId,
    title: input.title,
    clips: input.clips.map((clip) => ({
      asset_id: clip.assetId,
      label: clip.label,
      duration_seconds: clip.durationSeconds,
      source_in: 0,
      source_out: clip.durationSeconds,
      tags: ['scene-finder', 'qa-approved', 'sequence'],
    })),
    structure: 'narrative',
    target_runtime_seconds: total,
    fps: 24,
    resolution: '1920x1080',
    aspect_ratio: '16:9',
    include_dialogue: true,
    include_music: true,
    include_sfx: true,
    include_subtitles: true,
    run_continuity_qa: true,
    run_final_analyze_qa: true,
  });
}
