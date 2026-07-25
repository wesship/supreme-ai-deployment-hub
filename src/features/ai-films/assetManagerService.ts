import { supabase } from '@/integrations/supabase/client';
import { aiFilmImageTaxonomy, type ImageTaxonomySeed } from './imageTaxonomy';

export type AIFilmRecordStatus = 'draft' | 'selected' | 'approved' | 'canon' | 'archived';

export type AIFilmAsset = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  sourceFilename: string;
  storagePath?: string;
  category: string;
  subcategory: string;
  status: AIFilmRecordStatus;
  version: number;
  tags: string[];
  metadata: Record<string, unknown>;
};

export type AIFilmProject = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  status: AIFilmRecordStatus;
};

const requireUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sign in is required to manage AI Film Studio assets.');
  return data.user;
};

export const ensureSovereignSignalProject = async (): Promise<AIFilmProject> => {
  const user = await requireUser();
  const client = supabase as any;

  const { data: existing, error: readError } = await client
    .from('ai_film_projects')
    .select('id,slug,title,description,status')
    .eq('owner_id', user.id)
    .eq('slug', 'sovereign-signal')
    .maybeSingle();

  if (readError) throw readError;
  if (existing) {
    return {
      id: existing.id,
      slug: existing.slug,
      title: existing.title,
      description: existing.description || undefined,
      status: existing.status,
    };
  }

  const { data: created, error: createError } = await client
    .from('ai_film_projects')
    .insert({
      owner_id: user.id,
      slug: 'sovereign-signal',
      title: 'Sovereign Signal',
      description: 'Canonical D3VONN.IO AI Film Studio production universe.',
      format: 'franchise',
      status: 'canon',
      metadata: { universe: 'The Genesis Weave', source: 'completed-dump' },
    })
    .select('id,slug,title,description,status')
    .single();

  if (createError) throw createError;
  return {
    id: created.id,
    slug: created.slug,
    title: created.title,
    description: created.description || undefined,
    status: created.status,
  };
};

const mapAsset = (asset: any): AIFilmAsset => ({
  id: asset.id,
  projectId: asset.project_id,
  title: asset.title,
  description: asset.description || '',
  sourceFilename: asset.source_filename || '',
  storagePath: asset.storage_path || undefined,
  category: asset.category,
  subcategory: asset.subcategory || '',
  status: asset.status,
  version: Number(asset.version || 1),
  tags: asset.tags || [],
  metadata: asset.metadata || {},
});

export const fetchProjectAssets = async (projectId: string): Promise<AIFilmAsset[]> => {
  await requireUser();
  const { data, error } = await (supabase as any)
    .from('ai_film_assets')
    .select('id,project_id,title,description,source_filename,storage_path,category,subcategory,status,version,tags,metadata')
    .eq('project_id', projectId)
    .order('category')
    .order('title');

  if (error) throw error;
  return (data || []).map(mapAsset);
};

const seedToInsert = (seed: ImageTaxonomySeed, projectId: string, ownerId: string) => ({
  project_id: projectId,
  owner_id: ownerId,
  asset_type: 'image',
  title: seed.canonicalFilename.replace(/\.[^.]+$/, '').replaceAll('_', ' '),
  description: seed.description,
  source_filename: seed.sourceFilename,
  category: seed.category,
  subcategory: seed.subcategory,
  status: seed.category === 'ADMIN' ? 'approved' : 'canon',
  version: 1,
  tags: seed.tags,
  metadata: {
    canonical_filename: seed.canonicalFilename,
    import_source: 'Devonn_Image_Category_Map.pdf',
    dump_complete: true,
  },
});

export const importCompletedImageDump = async (projectId: string): Promise<number> => {
  const user = await requireUser();
  const client = supabase as any;

  const { data: existing, error: existingError } = await client
    .from('ai_film_assets')
    .select('source_filename')
    .eq('project_id', projectId)
    .in('source_filename', aiFilmImageTaxonomy.map((asset) => asset.sourceFilename));

  if (existingError) throw existingError;
  const existingFiles = new Set((existing || []).map((asset: any) => asset.source_filename));
  const pending = aiFilmImageTaxonomy
    .filter((asset) => !existingFiles.has(asset.sourceFilename))
    .map((asset) => seedToInsert(asset, projectId, user.id));

  if (pending.length === 0) return 0;
  const { error } = await client.from('ai_film_assets').insert(pending);
  if (error) throw error;
  return pending.length;
};

export const updateAssetStatus = async (assetId: string, status: AIFilmRecordStatus): Promise<void> => {
  await requireUser();
  const { error } = await (supabase as any)
    .from('ai_film_assets')
    .update({ status })
    .eq('id', assetId);
  if (error) throw error;
};
