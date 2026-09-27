import { useEffect, useMemo, useState } from 'react';
import { Clapperboard, Loader2, Search, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  createSceneBlueprint,
  dispatchSceneFusion,
  dispatchSceneProduction,
  searchScenes,
  sendSceneToTimeline,
  type SceneBlueprintResponse,
  type SceneFinderHit,
  type SceneFusionRole,
} from '@/features/ai-films/sceneFinderService';
import { getOpenMontageJob, type OpenMontageJobStatus } from '@/features/ai-films/openMontageService';
import { upsertReview } from '@/features/ai-films/releaseControlService';

function assetIdFor(hit: SceneFinderHit): string {
  return String(hit.asset_id || hit.video_id || '');
}

function timeLabel(value: unknown): string {
  return typeof value === 'number' ? `${value.toFixed(1)}s` : '—';
}

export default function SceneFinderWorkspace() {
  const [query, setQuery] = useState('');
  const [objective, setObjective] = useState('Adapt the cinematic technique into an original D3VONN.IO production scene.');
  const [scenes, setScenes] = useState<SceneFinderHit[]>([]);
  const [selected, setSelected] = useState<SceneFinderHit | null>(null);
  const [blueprint, setBlueprint] = useState<SceneBlueprintResponse | null>(null);
  const [production, setProduction] = useState<{ renderJobId: string; provider: string; projectId: string } | null>(null);
  const [renderStatus, setRenderStatus] = useState<OpenMontageJobStatus | null>(null);
  const [fusionSelections, setFusionSelections] = useState<Array<{ index: number; role: SceneFusionRole }>>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Search authorized indexed footage by action, mood, lighting, camera movement, dialogue context, or production technique.');

  const selectedAssetId = useMemo(() => selected ? assetIdFor(selected) : '', [selected]);


  useEffect(() => {
    if (!production?.renderJobId) return;
    let cancelled = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const status = await getOpenMontageJob(production.renderJobId);
        if (cancelled) return;
        setRenderStatus(status);
        const terminal = ['completed', 'failed'].includes(status.status) || ['revise', 'block', 'failed'].includes(status.review_state || '');
        if (!terminal) timer = window.setTimeout(() => { void poll(); }, 8000);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : 'Render status could not be refreshed.');
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [production?.renderJobId]);

  const runSearch = async () => {
    if (!query.trim()) return;
    setBusy(true);
    setBlueprint(null);
    try {
      const response = await searchScenes(query.trim());
      setScenes(response.scenes || []);
      setSelected(response.scenes?.[0] || null);
      setFusionSelections([]);
      setMessage(response.count ? `Found ${response.count} matching scene references.` : 'No matching indexed scenes were found.');
    } catch (error) {
      setScenes([]);
      setSelected(null);
      setMessage(error instanceof Error ? error.message : 'Scene Finder is unavailable.');
    } finally {
      setBusy(false);
    }
  };

  const runBlueprint = async () => {
    if (!selected || !selectedAssetId || !objective.trim()) return;
    setBusy(true);
    try {
      const response = await createSceneBlueprint({
        assetId: selectedAssetId,
        objective: objective.trim(),
        startTime: typeof selected.start === 'number' ? selected.start : undefined,
        endTime: typeof selected.end === 'number' ? selected.end : undefined,
      });
      setBlueprint(response);
      setProduction(null);
      setMessage('Scene DNA extracted. The adaptation blueprint preserves general technique while requiring original expression.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The scene blueprint could not be generated.');
    } finally {
      setBusy(false);
    }
  };


  const runProduction = async () => {
    if (!selected || !selectedAssetId || !objective.trim()) return;
    setBusy(true);
    try {
      const response = await dispatchSceneProduction({
        assetId: selectedAssetId,
        objective: objective.trim(),
        startTime: typeof selected.start === 'number' ? selected.start : undefined,
        endTime: typeof selected.end === 'number' ? selected.end : undefined,
        durationSeconds: 8,
        aspectRatio: '16:9',
      });
      setProduction({
        renderJobId: response.production.render_job_id,
        provider: response.production.provider,
        projectId: response.production.project_id,
      });
      setRenderStatus(null);
      setMessage('Production handoff queued. The scene is now in the governed AI Films render and QA pipeline.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The production handoff could not be queued.');
    } finally {
      setBusy(false);
    }
  };



  const fusionRoles: SceneFusionRole[] = ['camera', 'lighting', 'pacing', 'sound', 'production_design'];

  const toggleFusion = (index: number) => {
    setFusionSelections((current) => {
      const existing = current.find((item) => item.index === index);
      if (existing) return current.filter((item) => item.index !== index);
      if (current.length >= 5) return current;
      return [...current, { index, role: fusionRoles[current.length % fusionRoles.length] }];
    });
  };

  const setFusionRole = (index: number, role: SceneFusionRole) => {
    setFusionSelections((current) => current.map((item) => item.index === index ? { ...item, role } : item));
  };

  const runFusion = async () => {
    if (fusionSelections.length < 2 || !objective.trim()) return;
    setBusy(true);
    try {
      const references = fusionSelections.map(({ index, role }) => {
        const scene = scenes[index];
        return {
          assetId: assetIdFor(scene),
          role,
          startTime: typeof scene.start === 'number' ? scene.start : undefined,
          endTime: typeof scene.end === 'number' ? scene.end : undefined,
        };
      }).filter((reference) => Boolean(reference.assetId));
      if (references.length < 2) throw new Error('Select at least two indexed scene references for Scene Fusion.');
      const response = await dispatchSceneFusion({
        objective: objective.trim(),
        references,
        durationSeconds: 8,
        aspectRatio: '16:9',
      });
      setProduction({
        renderJobId: response.production.render_job_id,
        provider: response.production.provider,
        projectId: response.production.project_id,
      });
      setRenderStatus(null);
      setMessage(`Scene Fusion queued using ${response.reference_count} references: ${response.reference_roles.join(', ')}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Scene Fusion could not be queued.');
    } finally {
      setBusy(false);
    }
  };

  const saveReview = async (status: 'approved' | 'changes_requested') => {
    if (!production) return;
    setBusy(true);
    try {
      await upsertReview(
        production.projectId,
        'release',
        production.renderJobId,
        'producer',
        status,
        status === 'approved' ? 'Scene Finder render approved after QA review.' : 'Scene Finder render requires revision.',
      );
      setMessage(status === 'approved' ? 'Scene approved and recorded in Release Control.' : 'Revision request recorded in Release Control.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Review decision could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async () => {
    await runProduction();
  };

  const sendToTimeline = async () => {
    if (!production || !renderStatus?.result_asset_id) return;
    setBusy(true);
    try {
      const result = await sendSceneToTimeline({
        projectId: production.projectId,
        assetId: renderStatus.result_asset_id,
        label: objective.trim() || 'Scene Finder generated scene',
        durationSeconds: Math.max(4, (typeof selected?.end === 'number' && typeof selected?.start === 'number') ? selected.end - selected.start : 8),
      });
      setMessage(`Scene sent to AI Director timeline. Assembly job ${result.render_job.id} queued.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Scene could not be sent to the timeline.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="scene-finder-heading">
      <Card className="overflow-hidden border-primary/25">
        <div className="border-b border-border/70 bg-[radial-gradient(circle_at_85%_10%,rgba(34,211,238,.18),transparent_30%),linear-gradient(135deg,rgba(8,22,48,.92),rgba(2,6,15,.98))] p-6 text-white">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2"><Clapperboard className="h-5 w-5 text-cyan-300" /><Badge variant="secondary">Scene Intelligence</Badge></div>
              <h2 id="scene-finder-heading" className="mt-3 text-3xl font-bold">Movie Scene Finder</h2>
              <p className="mt-2 text-sm leading-6 text-blue-100/80">Find reference scenes by cinematic meaning, then convert their general filmmaking technique into an original production blueprint.</p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') void runSearch(); }}
              placeholder="Example: slow tracking shot through a crowded club with hard red practical lighting"
              className="border-white/15 bg-black/30 text-white placeholder:text-slate-400"
            />
            <Button type="button" onClick={() => void runSearch()} disabled={busy || !query.trim()}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Find Scenes
            </Button>
          </div>
        </div>

        <div className="space-y-6 p-6">
          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">{message}</p>

          {scenes.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {scenes.map((scene, index) => {
                const id = assetIdFor(scene) || `scene-${index}`;
                const active = selected === scene;
                return (
                  <Card key={`${id}-${index}`} className={`p-4 transition ${active ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <button
                      type="button"
                      onClick={() => { setSelected(scene); setBlueprint(null); }}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">Reference {index + 1}</span>
                        {typeof scene.score === 'number' && <Badge variant="outline">{Math.round(scene.score * 100)}%</Badge>}
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">{id}</p>
                      <p className="mt-2 text-sm text-muted-foreground">{timeLabel(scene.start)} → {timeLabel(scene.end)}</p>
                    </button>
                    <div className="mt-4 flex items-center gap-2 border-t border-border/70 pt-3">
                      <Button type="button" size="sm" variant={fusionSelections.some((item) => item.index === index) ? 'default' : 'outline'} onClick={() => toggleFusion(index)}>
                        {fusionSelections.some((item) => item.index === index) ? 'In Fusion' : 'Add to Fusion'}
                      </Button>
                      {fusionSelections.some((item) => item.index === index) && (
                        <select
                          className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                          value={fusionSelections.find((item) => item.index === index)?.role}
                          onChange={(event) => setFusionRole(index, event.target.value as SceneFusionRole)}
                          aria-label={`Fusion role for reference ${index + 1}`}
                        >
                          {fusionRoles.map((role) => <option key={role} value={role}>{role.replace('_', ' ')}</option>)}
                        </select>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {fusionSelections.length >= 2 && (
            <Card className="border-primary/30 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><h3 className="font-semibold">Scene Fusion</h3></div>
                  <p className="mt-2 text-sm text-muted-foreground">Fuse general camera, lighting, pacing, sound, and production-design DNA from 2–5 references into one materially original scene.</p>
                </div>
                <Button type="button" onClick={() => void runFusion()} disabled={busy || fusionSelections.length < 2 || !objective.trim()}>
                  <Sparkles className="mr-2 h-4 w-4" /> Create Scene Fusion
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {fusionSelections.map(({ index, role }) => <Badge key={index} variant="outline">Reference {index + 1}: {role.replace('_', ' ')}</Badge>)}
              </div>
            </Card>
          )}

          {selected && (
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <label htmlFor="scene-objective" className="text-sm font-medium">Original adaptation objective</label>
                <Textarea id="scene-objective" value={objective} onChange={(event) => setObjective(event.target.value)} className="mt-2 min-h-24" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => void runBlueprint()} disabled={busy || !selectedAssetId || !objective.trim()}>
                  <Sparkles className="mr-2 h-4 w-4" /> Analyze Scene DNA
                </Button>
                <Button type="button" onClick={() => void runProduction()} disabled={busy || !selectedAssetId || !objective.trim()}>
                  <Clapperboard className="mr-2 h-4 w-4" /> Recreate Technique
                </Button>
              </div>
            </div>
          )}

          {production && (
            <Card className="border-primary/30 bg-primary/5 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2"><Clapperboard className="h-4 w-4 text-primary" /><h3 className="font-semibold">Production monitor</h3></div>
                <Badge variant="outline">{renderStatus?.status || 'queued'}</Badge>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">Provider: {renderStatus?.provider || production.provider} · Render job: {production.renderJobId}</p>
              <p className="mt-1 text-xs text-muted-foreground">Project: {production.projectId}{renderStatus?.review_state ? ` · QA: ${renderStatus.review_state}` : ''}</p>
              {renderStatus?.stages?.length ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-4">
                  {renderStatus.stages.map((stage) => <div key={stage.name} className="rounded-lg border border-border/70 p-2 text-xs"><span className="font-medium">{stage.name}</span><span className="ml-2 text-muted-foreground">{stage.status}</span></div>)}
                </div>
              ) : null}
              {renderStatus?.video_url && <video className="mt-4 w-full rounded-xl border border-border" controls src={renderStatus.video_url} />}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" disabled={busy || renderStatus?.status !== 'completed'} onClick={() => void saveReview('approved')}>Approve</Button>
                <Button type="button" variant="outline" disabled={busy || !renderStatus} onClick={() => void saveReview('changes_requested')}>Revise</Button>
                <Button type="button" variant="outline" disabled={busy || !renderStatus} onClick={() => void regenerate()}>Regenerate</Button>
                <Button type="button" variant="secondary" disabled={busy || renderStatus?.status !== 'completed' || !renderStatus?.result_asset_id} onClick={() => void sendToTimeline()}>Send to Timeline</Button>
              </div>
              {renderStatus?.error && <p className="mt-3 text-sm text-destructive">{renderStatus.error}</p>}
            </Card>
          )}

          {blueprint && (
            <Card className="bg-muted/30 p-5">
              <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><h3 className="font-semibold">Original Production Blueprint</h3></div>
              <pre className="mt-4 max-h-[420px] overflow-auto whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                {typeof blueprint.result === 'string' ? blueprint.result : JSON.stringify(blueprint.result, null, 2)}
              </pre>
            </Card>
          )}
        </div>
      </Card>
    </section>
  );
}
