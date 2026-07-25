import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ListChecks, Play, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { AIFilmAsset, AIFilmProject, AIFilmRecordStatus } from './assetManagerService';
import { fetchScenes, type FilmScene } from './canonSceneService';
import {
  calculateReleaseBlockers,
  fetchReleaseChecklist,
  fetchRenderJobs,
  fetchReviews,
  queueRenderJob,
  seedReleaseChecklist,
  setChecklistItem,
  updateAssetStatus,
  upsertReview,
  type ChecklistItem,
  type RenderJob,
  type ReviewRecord,
} from './releaseControlService';

type Props = {
  project: AIFilmProject | null;
  assets: AIFilmAsset[];
  onAssetsChanged: () => Promise<void>;
};

export default function ReleaseControlWorkspace({ project, assets, onAssetsChanged }: Props) {
  const [scenes, setScenes] = useState<FilmScene[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [renderJobs, setRenderJobs] = useState<RenderJob[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedSceneId, setSelectedSceneId] = useState('');
  const [reviewSummary, setReviewSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Connect the Knowledge Core to manage release controls.');

  const refresh = async () => {
    if (!project) return;
    const [nextScenes, nextChecklist, nextReviews, nextJobs] = await Promise.all([
      fetchScenes(project.id),
      fetchReleaseChecklist(project.id),
      fetchReviews(project.id),
      fetchRenderJobs(project.id),
    ]);
    setScenes(nextScenes);
    setChecklist(nextChecklist);
    setReviews(nextReviews);
    setRenderJobs(nextJobs);
    setMessage(`Release control loaded: ${nextChecklist.length} checklist items, ${nextReviews.length} reviews, ${nextJobs.length} render jobs.`);
  };

  useEffect(() => { void refresh(); }, [project?.id]);

  const blockers = useMemo(
    () => calculateReleaseBlockers(assets, scenes, checklist, reviews, renderJobs),
    [assets, scenes, checklist, reviews, renderJobs],
  );
  const completeChecklist = checklist.filter((item) => item.completed).length;
  const approvedReviews = reviews.filter((review) => review.status === 'approved').length;
  const activeJobs = renderJobs.filter((job) => job.status === 'queued' || job.status === 'running').length;
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) || null;

  const initializeChecklist = async () => {
    if (!project) return;
    setBusy(true);
    try {
      await seedReleaseChecklist(project.id);
      await refresh();
      setMessage('Release checklist initialized.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Release checklist could not be initialized.');
    } finally { setBusy(false); }
  };

  const toggleChecklist = async (item: ChecklistItem) => {
    setBusy(true);
    try {
      await setChecklistItem(item.id, !item.completed);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Checklist item could not be updated.');
    } finally { setBusy(false); }
  };

  const changeAssetStatus = async (status: AIFilmRecordStatus) => {
    if (!selectedAsset) return;
    setBusy(true);
    try {
      await updateAssetStatus(selectedAsset, status);
      await onAssetsChanged();
      setMessage(`${selectedAsset.title} moved to ${status === 'selected' ? 'review' : status}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Asset status could not be updated.');
    } finally { setBusy(false); }
  };

  const submitReview = async (status: ReviewRecord['status']) => {
    if (!project || !selectedSceneId) return;
    setBusy(true);
    try {
      await upsertReview(project.id, 'scene', selectedSceneId, 'producer', status, reviewSummary);
      setReviewSummary('');
      await refresh();
      setMessage(`Producer review saved as ${status}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Review could not be saved.');
    } finally { setBusy(false); }
  };

  const queueStoryboard = async () => {
    if (!project) return;
    setBusy(true);
    try {
      await queueRenderJob(project.id, selectedSceneId || null, 'storyboard');
      await refresh();
      setMessage('Storyboard render job queued.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Render job could not be queued.');
    } finally { setBusy(false); }
  };

  return (
    <section className="space-y-6" aria-labelledby="release-control-heading">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">Release 4 · Review Pipeline</p>
          <h2 id="release-control-heading" className="mt-2 text-3xl font-bold">Release Control</h2>
        </div>
        <Button type="button" onClick={() => void initializeChecklist()} disabled={!project || busy}>
          <ListChecks className="mr-2 h-4 w-4" /> Initialize Release Checklist
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Checklist</p><p className="mt-2 text-2xl font-bold">{completeChecklist}/{checklist.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Approved reviews</p><p className="mt-2 text-2xl font-bold">{approvedReviews}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Active render jobs</p><p className="mt-2 text-2xl font-bold">{activeJobs}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Release blockers</p><p className="mt-2 text-2xl font-bold">{blockers.length}</p></Card>
      </div>

      <Card className="border-primary/20 p-4 text-sm text-muted-foreground" role="status" aria-live="polite">{message}</Card>

      {blockers.length > 0 && (
        <Card className="border-destructive/40 p-5">
          <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /><h3 className="font-bold">Release blockers</h3></div>
          <div className="mt-3 space-y-2">{blockers.map((blocker) => <p key={blocker} className="text-sm text-muted-foreground">• {blocker}</p>)}</div>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between"><h3 className="text-xl font-bold">Release Checklist</h3><Badge variant="outline">{checklist.length} items</Badge></div>
          <div className="mt-4 space-y-3">
            {checklist.length === 0 && <p className="text-sm text-muted-foreground">Initialize the checklist to begin release tracking.</p>}
            {checklist.map((item) => (
              <button key={item.id} type="button" onClick={() => void toggleChecklist(item)} disabled={busy} className="flex w-full items-center justify-between rounded-xl border border-border/70 p-3 text-left">
                <span><span className="font-medium">{item.label}</span><span className="ml-2 text-xs text-muted-foreground">{item.category}</span></span>
                {item.completed ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <span className="h-5 w-5 rounded-full border" />}
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-xl font-bold">Asset Approval</h3>
          <label className="mt-4 block text-sm font-medium">Production asset
            <select className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2" value={selectedAssetId} onChange={(event) => setSelectedAssetId(event.target.value)}>
              <option value="">Select an asset</option>
              {assets.filter((asset) => !asset.id.startsWith('seed-')).map((asset) => <option key={asset.id} value={asset.id}>{asset.title} · {asset.status === 'selected' ? 'review' : asset.status}</option>)}
            </select>
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={!selectedAsset || busy} onClick={() => void changeAssetStatus('selected')}>Send to Review</Button>
            <Button type="button" variant="outline" disabled={!selectedAsset || busy} onClick={() => void changeAssetStatus('approved')}>Approve</Button>
            <Button type="button" disabled={!selectedAsset || busy} onClick={() => void changeAssetStatus('canon')}><ShieldCheck className="mr-2 h-4 w-4" />Promote to Canon</Button>
            <Button type="button" variant="secondary" disabled={!selectedAsset || busy} onClick={() => void changeAssetStatus('archived')}>Archive</Button>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-xl font-bold">Scene Review</h3>
          <label className="mt-4 block text-sm font-medium">Scene
            <select className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2" value={selectedSceneId} onChange={(event) => setSelectedSceneId(event.target.value)}>
              <option value="">Select a scene</option>
              {scenes.map((scene) => <option key={scene.id} value={scene.id}>Scene {scene.sceneNumber}: {scene.title}</option>)}
            </select>
          </label>
          <label htmlFor="review-summary" className="mt-4 block text-sm font-medium">Review summary</label>
          <Input id="review-summary" className="mt-2" value={reviewSummary} onChange={(event) => setReviewSummary(event.target.value)} placeholder="Approval notes or requested changes" />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" disabled={!selectedSceneId || busy} onClick={() => void submitReview('approved')}>Approve Scene</Button>
            <Button type="button" variant="outline" disabled={!selectedSceneId || busy} onClick={() => void submitReview('changes_requested')}>Request Changes</Button>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between"><h3 className="text-xl font-bold">Render Queue</h3><Badge variant="outline">{renderJobs.length} jobs</Badge></div>
          <Button className="mt-4" type="button" disabled={!project || busy} onClick={() => void queueStoryboard()}><Play className="mr-2 h-4 w-4" />Queue Storyboard</Button>
          <div className="mt-4 space-y-3">
            {renderJobs.length === 0 && <p className="text-sm text-muted-foreground">No render jobs are queued.</p>}
            {renderJobs.map((job) => (
              <div key={job.id} className="rounded-xl border border-border/70 p-3">
                <div className="flex items-center justify-between"><span className="font-medium">{job.jobType}</span><Badge variant="outline">{job.status}</Badge></div>
                <p className="mt-1 text-xs text-muted-foreground">Provider: {job.provider} · Progress: {job.progress}%</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}
