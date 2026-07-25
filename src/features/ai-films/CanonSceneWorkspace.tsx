import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Link2, Plus, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  calculateProductionReadiness,
  createScene,
  fetchCanonRules,
  fetchScenes,
  linkAssetToScene,
  persistCanonValidation,
  upsertCanonRule,
  validateSceneAgainstCanon,
  type CanonRule,
  type FilmScene,
} from './canonSceneService';
import { sovereignSignalCanonSeeds } from './sovereignSignalCanon';
import type { AIFilmAsset, AIFilmProject } from './assetManagerService';

type Props = {
  project: AIFilmProject | null;
  assets: AIFilmAsset[];
};

const emptyScene = {
  episodeNumber: null as number | null,
  sceneNumber: 1,
  title: '',
  location: '',
  synopsis: '',
  screenplay: '',
};

export default function CanonSceneWorkspace({ project, assets }: Props) {
  const [rules, setRules] = useState<CanonRule[]>([]);
  const [scenes, setScenes] = useState<FilmScene[]>([]);
  const [sceneDraft, setSceneDraft] = useState(emptyScene);
  const [selectedSceneId, setSelectedSceneId] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Connect the Knowledge Core to manage canon and scenes.');

  const refresh = async () => {
    if (!project) return;
    const [nextRules, nextScenes] = await Promise.all([
      fetchCanonRules(project.id),
      fetchScenes(project.id),
    ]);
    setRules(nextRules);
    setScenes(nextScenes);
    setMessage(`Loaded ${nextRules.length} canon rules and ${nextScenes.length} scenes.`);
  };

  useEffect(() => {
    void refresh();
  }, [project?.id]);

  const readiness = useMemo(() => calculateProductionReadiness(scenes, rules), [scenes, rules]);
  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) || null;

  const seedRules = async () => {
    if (!project) return;
    setBusy(true);
    try {
      await Promise.all(sovereignSignalCanonSeeds.map((rule) => upsertCanonRule(project.id, rule)));
      await refresh();
      setMessage('Sovereign Signal canon rules are active.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Canon rules could not be seeded.');
    } finally {
      setBusy(false);
    }
  };

  const addScene = async () => {
    if (!project || !sceneDraft.title.trim()) return;
    setBusy(true);
    try {
      const sceneId = await createScene(project.id, {
        ...sceneDraft,
        location: sceneDraft.location || null,
        synopsis: sceneDraft.synopsis || null,
        screenplay: sceneDraft.screenplay || null,
      });
      setSceneDraft({ ...emptyScene, sceneNumber: scenes.length + 2 });
      await refresh();
      setSelectedSceneId(sceneId);
      setMessage('Scene created and added to production memory.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Scene could not be created.');
    } finally {
      setBusy(false);
    }
  };

  const validateSelectedScene = async () => {
    if (!selectedScene) return;
    setBusy(true);
    try {
      const result = validateSceneAgainstCanon(selectedScene, rules);
      await persistCanonValidation(selectedScene.id, result);
      await refresh();
      setMessage(result.status === 'passed' ? 'Scene passed canon validation.' : `${result.violations.length} canon violations found.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Scene validation failed.');
    } finally {
      setBusy(false);
    }
  };

  const linkSelectedAsset = async () => {
    if (!selectedSceneId || !selectedAssetId) return;
    setBusy(true);
    try {
      await linkAssetToScene(selectedSceneId, selectedAssetId, 'reference');
      setMessage('Asset linked to scene as a production reference.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Asset could not be linked.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-6" aria-labelledby="canon-scene-workspace-heading">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">Canon + Scene Intelligence</p>
          <h2 id="canon-scene-workspace-heading" className="mt-2 text-3xl font-bold">Production Control</h2>
        </div>
        <Button type="button" onClick={() => void seedRules()} disabled={!project || busy}>
          <ShieldCheck className="mr-2 h-4 w-4" /> Seed Locked Canon
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Readiness</p><p className="mt-2 text-2xl font-bold">{readiness.score}%</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Active rules</p><p className="mt-2 text-2xl font-bold">{readiness.activeRules}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Scenes</p><p className="mt-2 text-2xl font-bold">{readiness.totalScenes}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Passing</p><p className="mt-2 text-2xl font-bold">{readiness.passingScenes}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Packaged</p><p className="mt-2 text-2xl font-bold">{readiness.packagedScenes}</p></Card>
      </div>

      <Card className="border-primary/20 p-4 text-sm text-muted-foreground" role="status" aria-live="polite">{message}</Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-bold">Canon Manager</h3>
            <Badge variant="outline">{rules.length} rules</Badge>
          </div>
          <div className="mt-5 space-y-3">
            {rules.length === 0 && <p className="text-sm text-muted-foreground">No canon rules are stored yet.</p>}
            {rules.map((rule) => (
              <div key={rule.id} className="rounded-xl border border-border/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-semibold">{rule.title}</p><p className="mt-1 text-sm text-muted-foreground">{rule.description}</p></div>
                  <Badge variant={rule.severity === 'blocking' ? 'destructive' : 'outline'}>{rule.severity}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">{rule.appliesTo.map((item) => <Badge key={item} variant="secondary">{item}</Badge>)}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-xl font-bold">Create Scene</h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Input aria-label="Scene number" type="number" min={1} value={sceneDraft.sceneNumber} onChange={(event) => setSceneDraft((current) => ({ ...current, sceneNumber: Number(event.target.value) }))} />
            <Input aria-label="Episode number" type="number" min={1} placeholder="Episode (optional)" onChange={(event) => setSceneDraft((current) => ({ ...current, episodeNumber: event.target.value ? Number(event.target.value) : null }))} />
            <Input className="sm:col-span-2" placeholder="Scene title" value={sceneDraft.title} onChange={(event) => setSceneDraft((current) => ({ ...current, title: event.target.value }))} />
            <Input className="sm:col-span-2" placeholder="Location" value={sceneDraft.location} onChange={(event) => setSceneDraft((current) => ({ ...current, location: event.target.value }))} />
            <textarea className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm sm:col-span-2" placeholder="Synopsis" value={sceneDraft.synopsis} onChange={(event) => setSceneDraft((current) => ({ ...current, synopsis: event.target.value }))} />
            <textarea className="min-h-40 rounded-md border border-input bg-background px-3 py-2 text-sm sm:col-span-2" placeholder="Screenplay text" value={sceneDraft.screenplay} onChange={(event) => setSceneDraft((current) => ({ ...current, screenplay: event.target.value }))} />
          </div>
          <Button className="mt-4" type="button" onClick={() => void addScene()} disabled={!project || busy || !sceneDraft.title.trim()}><Plus className="mr-2 h-4 w-4" /> Add Scene</Button>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><h3 className="text-xl font-bold">Scene Manager</h3><p className="mt-1 text-sm text-muted-foreground">Validate scenes and attach production references.</p></div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void validateSelectedScene()} disabled={!selectedScene || busy}><ShieldAlert className="mr-2 h-4 w-4" /> Validate Scene</Button>
            <Button type="button" onClick={() => void linkSelectedAsset()} disabled={!selectedSceneId || !selectedAssetId || busy}><Link2 className="mr-2 h-4 w-4" /> Link Asset</Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <label className="text-sm font-medium">Scene
            <select className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2" value={selectedSceneId} onChange={(event) => setSelectedSceneId(event.target.value)}>
              <option value="">Select a scene</option>
              {scenes.map((scene) => <option key={scene.id} value={scene.id}>Scene {scene.sceneNumber}: {scene.title}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Production asset
            <select className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2" value={selectedAssetId} onChange={(event) => setSelectedAssetId(event.target.value)}>
              <option value="">Select an asset</option>
              {assets.filter((asset) => !asset.id.startsWith('seed-')).map((asset) => <option key={asset.id} value={asset.id}>{asset.title}</option>)}
            </select>
          </label>
        </div>

        {selectedScene && (
          <div className="mt-5 rounded-xl border border-border/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-semibold">{selectedScene.title}</p><p className="mt-1 text-sm text-muted-foreground">{selectedScene.location || 'Location not set'}</p></div>
              <Badge variant={selectedScene.canonValidation.status === 'passed' ? 'secondary' : 'outline'}>
                {selectedScene.canonValidation.status === 'passed' && <CheckCircle2 className="mr-1 h-3 w-3" />}
                {selectedScene.canonValidation.status}
              </Badge>
            </div>
            {selectedScene.canonValidation.violations.length > 0 && <div className="mt-4 space-y-2">{selectedScene.canonValidation.violations.map((violation) => <p key={`${violation.ruleKey}-${violation.message}`} className="text-sm text-destructive">{violation.message}</p>)}</div>}
          </div>
        )}
      </Card>
    </section>
  );
}
