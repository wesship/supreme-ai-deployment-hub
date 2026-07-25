import { supabase } from '@/integrations/supabase/client';

export type CanonSeverity = 'info' | 'warning' | 'error' | 'blocking';
export type SceneStatus = 'draft' | 'selected' | 'approved' | 'canon' | 'archived';

export type CanonRule = {
  id: string;
  projectId: string;
  ruleKey: string;
  title: string;
  description: string;
  appliesTo: string[];
  severity: CanonSeverity;
  validator: Record<string, unknown>;
  active: boolean;
};

export type FilmScene = {
  id: string;
  projectId: string;
  episodeNumber: number | null;
  sceneNumber: number;
  title: string;
  location: string | null;
  synopsis: string | null;
  screenplay: string | null;
  productionPackage: Record<string, unknown>;
  canonValidation: { status: string; violations: CanonViolation[] };
  status: SceneStatus;
};

export type CanonViolation = {
  ruleKey: string;
  severity: CanonSeverity;
  message: string;
};

const requireUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sign in is required to manage canon and scenes.');
  return data.user;
};

export const fetchCanonRules = async (projectId: string): Promise<CanonRule[]> => {
  const user = await requireUser();
  const { data, error } = await (supabase as any)
    .from('ai_film_canon_rules')
    .select('id,project_id,rule_key,title,description,applies_to,severity,validator,active')
    .eq('project_id', projectId)
    .eq('owner_id', user.id)
    .order('severity', { ascending: false });
  if (error) throw error;
  return (data || []).map((rule: any) => ({
    id: rule.id,
    projectId: rule.project_id,
    ruleKey: rule.rule_key,
    title: rule.title,
    description: rule.description,
    appliesTo: rule.applies_to || [],
    severity: rule.severity,
    validator: rule.validator || {},
    active: Boolean(rule.active),
  }));
};

export const upsertCanonRule = async (
  projectId: string,
  rule: Omit<CanonRule, 'id' | 'projectId'>,
): Promise<void> => {
  const user = await requireUser();
  const { error } = await (supabase as any).from('ai_film_canon_rules').upsert({
    project_id: projectId,
    owner_id: user.id,
    rule_key: rule.ruleKey,
    title: rule.title,
    description: rule.description,
    applies_to: rule.appliesTo,
    severity: rule.severity,
    validator: rule.validator,
    active: rule.active,
  }, { onConflict: 'project_id,rule_key' });
  if (error) throw error;
};

export const fetchScenes = async (projectId: string): Promise<FilmScene[]> => {
  const user = await requireUser();
  const { data, error } = await (supabase as any)
    .from('ai_film_scenes')
    .select('id,project_id,episode_number,scene_number,title,location,synopsis,screenplay,production_package,canon_validation,status')
    .eq('project_id', projectId)
    .eq('owner_id', user.id)
    .order('episode_number', { ascending: true, nullsFirst: true })
    .order('scene_number', { ascending: true });
  if (error) throw error;
  return (data || []).map((scene: any) => ({
    id: scene.id,
    projectId: scene.project_id,
    episodeNumber: scene.episode_number,
    sceneNumber: scene.scene_number,
    title: scene.title,
    location: scene.location,
    synopsis: scene.synopsis,
    screenplay: scene.screenplay,
    productionPackage: scene.production_package || {},
    canonValidation: scene.canon_validation || { status: 'pending', violations: [] },
    status: scene.status,
  }));
};

export const createScene = async (
  projectId: string,
  scene: Pick<FilmScene, 'episodeNumber' | 'sceneNumber' | 'title' | 'location' | 'synopsis' | 'screenplay'>,
): Promise<string> => {
  const user = await requireUser();
  const { data, error } = await (supabase as any).from('ai_film_scenes').insert({
    project_id: projectId,
    owner_id: user.id,
    episode_number: scene.episodeNumber,
    scene_number: scene.sceneNumber,
    title: scene.title,
    location: scene.location,
    synopsis: scene.synopsis,
    screenplay: scene.screenplay,
  }).select('id').single();
  if (error) throw error;
  return data.id;
};

export const linkAssetToScene = async (sceneId: string, assetId: string, usageType = 'reference', notes?: string) => {
  await requireUser();
  const { error } = await (supabase as any).from('ai_film_scene_assets').upsert({
    scene_id: sceneId,
    asset_id: assetId,
    usage_type: usageType,
    notes: notes || null,
  }, { onConflict: 'scene_id,asset_id,usage_type' });
  if (error) throw error;
};

const matchesRequiredTerms = (text: string, terms: unknown) =>
  Array.isArray(terms) && terms.every((term) => text.includes(String(term).toLowerCase()));

export const validateSceneAgainstCanon = (scene: FilmScene, rules: CanonRule[]) => {
  const haystack = `${scene.title} ${scene.location || ''} ${scene.synopsis || ''} ${scene.screenplay || ''}`.toLowerCase();
  const violations: CanonViolation[] = [];

  rules.filter((rule) => rule.active).forEach((rule) => {
    const requiredTerms = rule.validator.requiredTerms;
    const forbiddenTerms = rule.validator.forbiddenTerms;
    if (Array.isArray(requiredTerms) && !matchesRequiredTerms(haystack, requiredTerms)) {
      violations.push({ ruleKey: rule.ruleKey, severity: rule.severity, message: `${rule.title}: required canon terms are missing.` });
    }
    if (Array.isArray(forbiddenTerms)) {
      forbiddenTerms.filter((term) => haystack.includes(String(term).toLowerCase())).forEach((term) => {
        violations.push({ ruleKey: rule.ruleKey, severity: rule.severity, message: `${rule.title}: forbidden term “${String(term)}” was detected.` });
      });
    }
  });

  return {
    status: violations.some((item) => item.severity === 'blocking' || item.severity === 'error') ? 'failed' : 'passed',
    violations,
  };
};

export const persistCanonValidation = async (sceneId: string, result: ReturnType<typeof validateSceneAgainstCanon>) => {
  await requireUser();
  const { error } = await (supabase as any)
    .from('ai_film_scenes')
    .update({ canon_validation: result })
    .eq('id', sceneId);
  if (error) throw error;
};

export const calculateProductionReadiness = (scenes: FilmScene[], rules: CanonRule[]) => {
  const activeRules = rules.filter((rule) => rule.active).length;
  const validatedScenes = scenes.filter((scene) => scene.canonValidation.status !== 'pending').length;
  const passingScenes = scenes.filter((scene) => scene.canonValidation.status === 'passed').length;
  const packagedScenes = scenes.filter((scene) => Object.keys(scene.productionPackage || {}).length > 0).length;
  const denominator = Math.max(1, scenes.length * 2);
  const score = Math.round(((passingScenes + packagedScenes) / denominator) * 100);
  return { score, activeRules, validatedScenes, passingScenes, packagedScenes, totalScenes: scenes.length };
};
