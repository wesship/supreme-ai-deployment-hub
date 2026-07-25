import { supabase } from '@/integrations/supabase/client';

const requireUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sign in is required to manage AI Film delivery.');
  return data.user;
};

export type ExportJob = {
  id: string;
  title: string;
  exportType: 'feature' | 'episode' | 'trailer' | 'teaser' | 'social' | 'archive';
  aspectRatio: string;
  resolution: string;
  format: string;
  status: string;
};

export type Publication = {
  id: string;
  exportJobId: string;
  destination: 'd3vonn' | 'internal-review' | 'archive' | 'social' | 'streaming';
  status: string;
};

export const createExportJob = async (projectId: string, input: Omit<ExportJob, 'id' | 'status'>) => {
  const user = await requireUser();
  const { data, error } = await (supabase as any).from('ai_film_export_jobs').insert({
    project_id: projectId,
    owner_id: user.id,
    title: input.title,
    export_type: input.exportType,
    aspect_ratio: input.aspectRatio,
    resolution: input.resolution,
    format: input.format,
    status: 'draft',
    manifest: { created_by: 'd3vonn-delivery-v1' },
  }).select('id').single();
  if (error) throw error;
  return data.id as string;
};

export const fetchExportJobs = async (projectId: string): Promise<ExportJob[]> => {
  const user = await requireUser();
  const { data, error } = await (supabase as any)
    .from('ai_film_export_jobs')
    .select('id,title,export_type,aspect_ratio,resolution,format,status')
    .eq('project_id', projectId)
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row: any) => ({
    id: row.id,
    title: row.title,
    exportType: row.export_type,
    aspectRatio: row.aspect_ratio,
    resolution: row.resolution,
    format: row.format,
    status: row.status,
  }));
};

export const createSubtitleTrack = async (projectId: string, exportJobId: string, languageCode: string, label: string) => {
  const user = await requireUser();
  const { error } = await (supabase as any).from('ai_film_subtitle_tracks').upsert({
    project_id: projectId,
    export_job_id: exportJobId,
    owner_id: user.id,
    language_code: languageCode,
    label,
    format: 'vtt',
    status: 'draft',
    cues: [],
  }, { onConflict: 'export_job_id,language_code' });
  if (error) throw error;
};

export const queuePublication = async (projectId: string, exportJobId: string, destination: Publication['destination']) => {
  const user = await requireUser();
  const { error } = await (supabase as any).from('ai_film_publications').upsert({
    project_id: projectId,
    export_job_id: exportJobId,
    owner_id: user.id,
    destination,
    status: 'draft',
    metadata: { approval_required: true },
  }, { onConflict: 'export_job_id,destination' });
  if (error) throw error;
};

export const fetchPublications = async (projectId: string): Promise<Publication[]> => {
  const user = await requireUser();
  const { data, error } = await (supabase as any)
    .from('ai_film_publications')
    .select('id,export_job_id,destination,status')
    .eq('project_id', projectId)
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row: any) => ({ id: row.id, exportJobId: row.export_job_id, destination: row.destination, status: row.status }));
};

export const registerRenderAttempt = async (renderJobId: string, projectId: string, provider: string, request: Record<string, unknown>) => {
  const user = await requireUser();
  const { error } = await (supabase as any).from('ai_film_render_attempts').insert({
    render_job_id: renderJobId,
    project_id: projectId,
    owner_id: user.id,
    provider,
    status: 'queued',
    request,
  });
  if (error) throw error;
};
