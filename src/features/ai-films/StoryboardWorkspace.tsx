import { useEffect, useMemo, useState } from 'react';
import { Camera, Clapperboard, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { AIFilmProject } from './assetManagerService';
import { fetchScenes, type FilmScene } from './canonSceneService';
import { fetchStoryboards, generateStoryboardPlan, type StoryboardRecord } from './storyboardService';

type Props = { project: AIFilmProject | null };

export default function StoryboardWorkspace({ project }: Props) {
  const [scenes, setScenes] = useState<FilmScene[]>([]);
  const [storyboards, setStoryboards] = useState<StoryboardRecord[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState('');
  const [selectedStoryboardId, setSelectedStoryboardId] = useState('');
  const [stylePrompt, setStylePrompt] = useState('Prestige metaphysical techno-thriller, restrained Signal VFX, deep indigo, practical light, calm cinematic weight');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Connect the Knowledge Core to generate storyboard and shot plans.');

  const refresh = async () => {
    if (!project) return;
    const [nextScenes, nextBoards] = await Promise.all([fetchScenes(project.id), fetchStoryboards(project.id)]);
    setScenes(nextScenes);
    setStoryboards(nextBoards);
    setMessage(`Loaded ${nextScenes.length} scenes and ${nextBoards.length} storyboard plans.`);
  };

  useEffect(() => { void refresh(); }, [project?.id]);

  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) || null;
  const selectedStoryboard = useMemo(
    () => storyboards.find((board) => board.id === selectedStoryboardId) || storyboards.find((board) => board.sceneId === selectedSceneId) || null,
    [selectedStoryboardId, selectedSceneId, storyboards],
  );

  const generate = async () => {
    if (!project || !selectedScene) return;
    setBusy(true);
    try {
      const id = await generateStoryboardPlan(project.id, selectedScene, stylePrompt);
      await refresh();
      setSelectedStoryboardId(id);
      setMessage(`Generated a five-shot storyboard plan for ${selectedScene.title}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Storyboard plan could not be generated.');
    } finally { setBusy(false); }
  };

  return (
    <section className="space-y-6" aria-labelledby="storyboard-workspace-heading">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">Release 5 · AI Pre-Production</p>
        <h2 id="storyboard-workspace-heading" className="mt-2 text-3xl font-bold">Storyboard + Shot Planner</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Storyboards</p><p className="mt-2 text-2xl font-bold">{storyboards.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Planned shots</p><p className="mt-2 text-2xl font-bold">{storyboards.reduce((sum, board) => sum + board.shots.length, 0)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Scenes ready</p><p className="mt-2 text-2xl font-bold">{scenes.filter((scene) => scene.canonValidation.status === 'passed').length}</p></Card>
      </div>

      <Card className="border-primary/20 p-4 text-sm text-muted-foreground" role="status" aria-live="polite">{message}</Card>

      <Card className="p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_2fr_auto] lg:items-end">
          <label className="text-sm font-medium">Approved scene
            <select className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2" value={selectedSceneId} onChange={(event) => setSelectedSceneId(event.target.value)}>
              <option value="">Select a scene</option>
              {scenes.map((scene) => <option key={scene.id} value={scene.id}>Scene {scene.sceneNumber}: {scene.title}</option>)}
            </select>
          </label>
          <label htmlFor="storyboard-style" className="text-sm font-medium">Visual direction
            <Input id="storyboard-style" className="mt-2" value={stylePrompt} onChange={(event) => setStylePrompt(event.target.value)} />
          </label>
          <Button type="button" disabled={!project || !selectedScene || busy} onClick={() => void generate()}><Sparkles className="mr-2 h-4 w-4" />Generate Shot Plan</Button>
        </div>
      </Card>

      {selectedStoryboard && (
        <Card className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h3 className="text-xl font-bold">{selectedStoryboard.title}</h3><p className="mt-1 text-sm text-muted-foreground">{selectedStoryboard.frameCount} frames · {selectedStoryboard.status}</p></div>
            <Badge variant="outline">Director AI Planner v1</Badge>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {selectedStoryboard.shots.map((shot) => (
              <div key={shot.shotNumber} className="rounded-2xl border border-border/70 p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Shot {shot.shotNumber}</p><h4 className="mt-1 font-bold">{shot.shotType}</h4></div><Camera className="h-5 w-5 text-primary" /></div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{shot.description}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <p><span className="font-semibold">Lens:</span> {shot.lens}</p>
                  <p><span className="font-semibold">Duration:</span> {shot.durationSeconds}s</p>
                  <p><span className="font-semibold">Angle:</span> {shot.cameraAngle}</p>
                  <p><span className="font-semibold">Move:</span> {shot.cameraMovement}</p>
                </div>
                <p className="mt-3 text-xs text-muted-foreground"><span className="font-semibold text-foreground">Lighting:</span> {shot.lighting}</p>
                <p className="mt-2 text-xs text-muted-foreground"><span className="font-semibold text-foreground">Blocking:</span> {shot.blocking}</p>
                <details className="mt-3"><summary className="cursor-pointer text-xs font-semibold">Image prompt</summary><p className="mt-2 text-xs leading-5 text-muted-foreground">{shot.imagePrompt}</p></details>
              </div>
            ))}
          </div>
        </Card>
      )}

      {storyboards.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2"><Clapperboard className="h-5 w-5 text-primary" /><h3 className="font-bold">Storyboard Library</h3></div>
          <div className="mt-4 flex flex-wrap gap-2">{storyboards.map((board) => <Button key={board.id} type="button" variant={selectedStoryboard?.id === board.id ? 'default' : 'outline'} onClick={() => setSelectedStoryboardId(board.id)}>{board.title}</Button>)}</div>
        </Card>
      )}
    </section>
  );
}
