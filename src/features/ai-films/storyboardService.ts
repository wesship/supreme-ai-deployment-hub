import { supabase } from '@/integrations/supabase/client';
import type { FilmScene } from './canonSceneService';

const requireUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sign in is required to manage storyboards.');
  return data.user;
};

export type PlannedShot = {
  id?: string;
  shotNumber: number;
  shotType: string;
  description: string;
  cameraAngle: string;
  cameraMovement: string;
  lens: string;
  durationSeconds: number;
  lighting: string;
  blocking: string;
  imagePrompt: string;
  status?: string;
};

export type StoryboardRecord = {
  id: string;
  sceneId: string;
  title: string;
  status: string;
  stylePrompt: string | null;
  frameCount: number;
  shots: PlannedShot[];
};

const sceneText = (scene: FilmScene) => `${scene.title}. ${scene.location || ''}. ${scene.synopsis || ''}. ${scene.screenplay || ''}`.trim();

export const planStoryboardShots = (scene: FilmScene, stylePrompt: string): PlannedShot[] => {
  const context = sceneText(scene);
  const location = scene.location || 'unspecified location';
  return [
    {
      shotNumber: 1,
      shotType: 'Establishing wide',
      description: `Establish ${location} and the scene's emotional pressure before dialogue begins.`,
      cameraAngle: 'Eye level',
      cameraMovement: 'Slow controlled push-in',
      lens: '24mm',
      durationSeconds: 5,
      lighting: 'Motivated environmental light with restrained contrast',
      blocking: 'Characters enter or hold in spatial relationship to the environment',
      imagePrompt: `${stylePrompt}. Cinematic establishing frame of ${location}. ${context}`,
    },
    {
      shotNumber: 2,
      shotType: 'Medium master',
      description: 'Cover the primary action and preserve continuity between characters and key props.',
      cameraAngle: 'Eye level',
      cameraMovement: 'Locked or subtle slider move',
      lens: '35mm',
      durationSeconds: 8,
      lighting: 'Shape faces while retaining practical sources',
      blocking: 'Maintain clear eyelines and screen direction',
      imagePrompt: `${stylePrompt}. Medium master shot with readable character blocking. ${context}`,
    },
    {
      shotNumber: 3,
      shotType: 'Character close-up',
      description: 'Capture the scene-turning emotional beat without overstating the visual effect.',
      cameraAngle: 'Slightly below eye line',
      cameraMovement: 'Near-static micro push',
      lens: '75mm',
      durationSeconds: 4,
      lighting: 'Soft directional key with controlled falloff',
      blocking: 'Subject remains still while background behavior carries tension',
      imagePrompt: `${stylePrompt}. Intimate cinematic close-up, restrained performance, subtle environmental signal behavior. ${context}`,
    },
    {
      shotNumber: 4,
      shotType: 'Insert or symbolic detail',
      description: 'Show the object, symbol, reflection, or environmental trace that advances the metaphysical layer.',
      cameraAngle: 'Detail angle',
      cameraMovement: 'Precise rack focus',
      lens: '100mm macro',
      durationSeconds: 3,
      lighting: 'Selective highlight with deep negative space',
      blocking: 'Hands, prop, reflection, or light behavior only',
      imagePrompt: `${stylePrompt}. Symbolic cinematic insert, tactile detail, restrained signal motif. ${context}`,
    },
    {
      shotNumber: 5,
      shotType: 'Exit or transition',
      description: 'Resolve the visual beat and prepare the editorial transition to the next scene.',
      cameraAngle: 'Wide or profile',
      cameraMovement: 'Measured lateral move or static hold',
      lens: '40mm',
      durationSeconds: 5,
      lighting: 'Allow the final light behavior to settle rather than flare',
      blocking: 'Character exits, turns, or remains while the environment changes',
      imagePrompt: `${stylePrompt}. Final transition frame with calm visual weight and unresolved tension. ${context}`,
    },
  ];
};

export const generateStoryboardPlan = async (projectId: string, scene: FilmScene, stylePrompt: string): Promise<string> => {
  const user = await requireUser();
  const shots = planStoryboardShots(scene, stylePrompt);
  const { data: storyboard, error: storyboardError } = await (supabase as any).from('ai_film_storyboards').upsert({
    project_id: projectId,
    scene_id: scene.id,
    owner_id: user.id,
    title: `${scene.title} Storyboard`,
    status: 'generated',
    style_prompt: stylePrompt || null,
    frame_count: shots.length,
    metadata: { generator: 'd3vonn-director-planner-v1' },
  }, { onConflict: 'scene_id' }).select('id').single();
  if (storyboardError) throw storyboardError;

  const rows = shots.map((shot) => ({
    storyboard_id: storyboard.id,
    project_id: projectId,
    scene_id: scene.id,
    owner_id: user.id,
    shot_number: shot.shotNumber,
    shot_type: shot.shotType,
    description: shot.description,
    camera_angle: shot.cameraAngle,
    camera_movement: shot.cameraMovement,
    lens: shot.lens,
    duration_seconds: shot.durationSeconds,
    lighting: shot.lighting,
    blocking: shot.blocking,
    image_prompt: shot.imagePrompt,
    status: 'planned',
    metadata: { source: 'director-ai-planner' },
  }));
  const { error: shotsError } = await (supabase as any).from('ai_film_shots').upsert(rows, { onConflict: 'storyboard_id,shot_number' });
  if (shotsError) throw shotsError;
  return storyboard.id;
};

export const fetchStoryboards = async (projectId: string): Promise<StoryboardRecord[]> => {
  const user = await requireUser();
  const { data: boards, error: boardsError } = await (supabase as any)
    .from('ai_film_storyboards')
    .select('id,scene_id,title,status,style_prompt,frame_count')
    .eq('project_id', projectId)
    .eq('owner_id', user.id)
    .order('updated_at', { ascending: false });
  if (boardsError) throw boardsError;
  if (!boards?.length) return [];
  const ids = boards.map((board: any) => board.id);
  const { data: shots, error: shotsError } = await (supabase as any)
    .from('ai_film_shots')
    .select('id,storyboard_id,shot_number,shot_type,description,camera_angle,camera_movement,lens,duration_seconds,lighting,blocking,image_prompt,status')
    .in('storyboard_id', ids)
    .eq('owner_id', user.id)
    .order('shot_number');
  if (shotsError) throw shotsError;
  return boards.map((board: any) => ({
    id: board.id,
    sceneId: board.scene_id,
    title: board.title,
    status: board.status,
    stylePrompt: board.style_prompt,
    frameCount: board.frame_count,
    shots: (shots || []).filter((shot: any) => shot.storyboard_id === board.id).map((shot: any) => ({
      id: shot.id,
      shotNumber: shot.shot_number,
      shotType: shot.shot_type,
      description: shot.description,
      cameraAngle: shot.camera_angle,
      cameraMovement: shot.camera_movement,
      lens: shot.lens,
      durationSeconds: Number(shot.duration_seconds || 0),
      lighting: shot.lighting,
      blocking: shot.blocking,
      imagePrompt: shot.image_prompt,
      status: shot.status,
    })),
  }));
};
