import { supabase } from '@/integrations/supabase/client';
import type { AIFilmAsset } from './assetManagerService';
import type { FilmScene } from './canonSceneService';

const requireUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sign in is required to manage AI Film releases.');
  return data.user;
};

export type ReviewRecord = {
  id: string;
  targetType: 'asset' | 'scene' | 'release';
  targetId: string;
  reviewType: 'producer' | 'director' | 'canon' | 'technical';
  status: 'pending' | 'approved' | 'changes_requested' | 'rejected';
  summary: string | null;
};

export type ChecklistItem = {
  id: string;
  itemKey: string;
  label: string;
  category: string;
  required: boolean;
  completed: boolean;
};

export type RenderJob = {
  id: string;
  sceneId: string | null;
  jobType: 'storyboard' | 'keyframe' | 'video' | 'voice' | 'music' | 'trailer' | 'export';
  provider: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  priority: number;
  progress: number;
  errorMessage: string | null;
};

export const seedReleaseChecklist = async (projectId: string) => {
  const user = await requireUser();
  const items = [
    ['canon-rules-active', 'Canon rules active', 'Canon'],
    ['assets-approved', 'Production assets approved', 'Assets'],
    ['scenes-validated', 'All scenes canon validated', 'Scenes'],
    ['packages-complete', 'Scene production packages complete', 'Production'],
    ['reviews-approved', 'Producer and technical reviews approved', 'Review'],
    ['render-plan-ready', 'Render plan queued', 'Render'],
    ['release-assets-ready', 'Release assets and exports ready', 'Delivery'],
  ].map(([itemKey, label, category]) => ({
    project_id: projectId,
    owner_id: user.id,
    item_key: itemKey,
    label,
    category,
    required: true,
  }));
  const { error } = await (supabase as any).from('ai_film_release_checklists').upsert(items, { onConflict: 'project_id,item_key' });
  if (error) throw error;
};

export const fetchReleaseChecklist = async (projectId: string): Promise<ChecklistItem[]> => {
  const user = await requireUser();
  const { data, error } = await (supabase as any)
    .from('ai_film_release_checklists')
    .select('id,item_key,label,category,required,completed')
    .eq('project_id', projectId)
    .eq('owner_id', user.id)
    .order('category');
  if (error) throw error;
  return (data || []).map((item: any) => ({
    id: item.id,
    itemKey: item.item_key,
    label: item.label,
    category: item.category,
    required: item.required,
    completed: item.completed,
  }));
};

export const setChecklistItem = async (id: string, completed: boolean) => {
  await requireUser();
  const { error } = await (supabase as any)
    .from('ai_film_release_checklists')
    .update({ completed, completed_at: completed ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
};

export const upsertReview = async (
  projectId: string,
  targetType: ReviewRecord['targetType'],
  targetId: string,
  reviewType: ReviewRecord['reviewType'],
  status: ReviewRecord['status'],
  summary: string,
) => {
  const user = await requireUser();
  const { error } = await (supabase as any).from('ai_film_reviews').upsert({
    project_id: projectId,
    owner_id: user.id,
    target_type: targetType,
    target_id: targetId,
    review_type: reviewType,
    status,
    summary: summary || null,
    reviewer_id: user.id,
    reviewed_at: status === 'pending' ? null : new Date().toISOString(),
  }, { onConflict: 'project_id,target_type,target_id,review_type' });
  if (error) throw error;
};

export const fetchReviews = async (projectId: string): Promise<ReviewRecord[]> => {
  const user = await requireUser();
  const { data, error } = await (supabase as any)
    .from('ai_film_reviews')
    .select('id,target_type,target_id,review_type,status,summary')
    .eq('project_id', projectId)
    .eq('owner_id', user.id)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((item: any) => ({
    id: item.id,
    targetType: item.target_type,
    targetId: item.target_id,
    reviewType: item.review_type,
    status: item.status,
    summary: item.summary,
  }));
};

export const queueRenderJob = async (projectId: string, sceneId: string | null, jobType: RenderJob['jobType']) => {
  const user = await requireUser();
  const { error } = await (supabase as any).from('ai_film_render_jobs').insert({
    project_id: projectId,
    scene_id: sceneId,
    owner_id: user.id,
    job_type: jobType,
    provider: 'unassigned',
    status: 'queued',
    priority: 50,
    progress: 0,
    input: { source: 'ai-film-studio' },
  });
  if (error) throw error;
};

export const fetchRenderJobs = async (projectId: string): Promise<RenderJob[]> => {
  const user = await requireUser();
  const { data, error } = await (supabase as any)
    .from('ai_film_render_jobs')
    .select('id,scene_id,job_type,provider,status,priority,progress,error_message')
    .eq('project_id', projectId)
    .eq('owner_id', user.id)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((item: any) => ({
    id: item.id,
    sceneId: item.scene_id,
    jobType: item.job_type,
    provider: item.provider,
    status: item.status,
    priority: item.priority,
    progress: item.progress,
    errorMessage: item.error_message,
  }));
};

export const snapshotAssetVersion = async (asset: AIFilmAsset, changeNote: string) => {
  const user = await requireUser();
  const { error } = await (supabase as any).from('ai_film_asset_versions').upsert({
    project_id: asset.projectId,
    asset_id: asset.id,
    owner_id: user.id,
    version: asset.version,
    snapshot: asset,
    change_note: changeNote || null,
  }, { onConflict: 'asset_id,version' });
  if (error) throw error;
};

export const updateAssetStatus = async (asset: AIFilmAsset, status: 'draft' | 'review' | 'approved' | 'canon' | 'archived') => {
  await snapshotAssetVersion(asset, `Status changed to ${status}`);
  const { error } = await (supabase as any).from('ai_film_assets').update({ status }).eq('id', asset.id);
  if (error) throw error;
};

export const calculateReleaseBlockers = (
  assets: AIFilmAsset[],
  scenes: FilmScene[],
  checklist: ChecklistItem[],
  reviews: ReviewRecord[],
  renderJobs: RenderJob[],
) => {
  const blockers: string[] = [];
  if (assets.some((asset) => !['approved', 'canon', 'archived'].includes(asset.status))) blockers.push('Assets remain in draft or review.');
  if (scenes.some((scene) => scene.canonValidation.status !== 'passed')) blockers.push('One or more scenes have not passed canon validation.');
  if (scenes.some((scene) => Object.keys(scene.productionPackage || {}).length === 0)) blockers.push('One or more scenes are missing production packages.');
  if (checklist.some((item) => item.required && !item.completed)) blockers.push('Required release checklist items are incomplete.');
  if (reviews.some((review) => review.status === 'changes_requested' || review.status === 'rejected')) blockers.push('A review has requested changes or rejected content.');
  if (!renderJobs.some((job) => job.status === 'queued' || job.status === 'running' || job.status === 'succeeded')) blockers.push('No render job has been queued.');
  return blockers;
};
