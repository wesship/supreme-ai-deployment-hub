import { supabase } from '@/integrations/supabase/client';
import type { AIFilmAsset } from './assetManagerService';

const BUCKET = 'ai-film-media';

const requireUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sign in is required to upload AI Film media.');
  return data.user;
};

const sanitizeFilename = (name: string) => name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');

export const resolveFilmAssetContentType = (file: Pick<File, 'name' | 'type'>): string | undefined => {
  if (file.name.toLowerCase().endsWith('.exr')) return 'image/x-exr';
  return file.type || undefined;
};

export const uploadFilmAsset = async (projectId: string, file: File, category = 'REFERENCE'): Promise<AIFilmAsset> => {
  const user = await requireUser();
  const storagePath = `${user.id}/${projectId}/${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;
  const contentType = resolveFilmAssetContentType(file);
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    contentType,
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await (supabase as any).from('ai_film_assets').insert({
    project_id: projectId,
    owner_id: user.id,
    title: file.name.replace(/\.[^.]+$/, ''),
    description: 'Uploaded through AI Film Studio.',
    source_filename: file.name,
    storage_path: storagePath,
    category,
    subcategory: 'Uploaded',
    status: 'draft',
    version: 1,
    tags: ['uploaded'],
    metadata: { mime_type: contentType || file.type, size_bytes: file.size },
  }).select('id,project_id,title,description,source_filename,storage_path,category,subcategory,status,version,tags,metadata').single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw error;
  }

  return {
    id: data.id,
    projectId: data.project_id,
    title: data.title,
    description: data.description,
    sourceFilename: data.source_filename,
    storagePath: data.storage_path,
    category: data.category,
    subcategory: data.subcategory,
    status: data.status,
    version: data.version,
    tags: data.tags || [],
    metadata: data.metadata || {},
  };
};

export const createAssetPreviewUrl = async (storagePath: string, expiresIn = 900) => {
  await requireUser();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn);
  if (error) throw error;
  return data.signedUrl;
};

export type ProductionPackage = {
  cameraPlan: string;
  lightingPlan: string;
  audioPlan: string;
  vfxPlan: string;
  editNotes: string;
};

export const saveProductionPackage = async (sceneId: string, productionPackage: ProductionPackage) => {
  await requireUser();
  const { error } = await (supabase as any)
    .from('ai_film_scenes')
    .update({ production_package: productionPackage })
    .eq('id', sceneId);
  if (error) throw error;
};

export const getReleaseReadinessDetails = (assets: AIFilmAsset[], scenes: Array<{ canonValidation: { status: string }; productionPackage: Record<string, unknown> }>) => {
  const uploadedAssets = assets.filter((asset) => Boolean(asset.storagePath)).length;
  const canonAssets = assets.filter((asset) => asset.status === 'canon').length;
  const passingScenes = scenes.filter((scene) => scene.canonValidation.status === 'passed').length;
  const packagedScenes = scenes.filter((scene) => Object.keys(scene.productionPackage || {}).length > 0).length;
  const totalChecks = Math.max(1, assets.length + scenes.length * 2);
  const completedChecks = canonAssets + passingScenes + packagedScenes;
  return {
    score: Math.round((completedChecks / totalChecks) * 100),
    uploadedAssets,
    canonAssets,
    passingScenes,
    packagedScenes,
    totalAssets: assets.length,
    totalScenes: scenes.length,
  };
};
