import { useEffect, useMemo, useState } from 'react';
import { BarChart3, BriefcaseBusiness, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { AIFilmAsset, AIFilmProject } from './assetManagerService';
import { fetchScenes } from './canonSceneService';
import { fetchRenderJobs } from './releaseControlService';
import {
  createAnalyticsSnapshot,
  createCommercialRelease,
  fetchCollaborators,
  fetchCommercialReleases,
  inviteCollaborator,
  type Collaborator,
  type CommercialRelease,
} from './enterpriseStudioService';

type Props = { project: AIFilmProject | null; assets: AIFilmAsset[] };

export default function EnterpriseStudioWorkspace({ project, assets }: Props) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [releases, setReleases] = useState<CommercialRelease[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Collaborator['role']>('reviewer');
  const [releaseTitle, setReleaseTitle] = useState('Sovereign Signal Commercial Release');
  const [releaseType, setReleaseType] = useState<CommercialRelease['releaseType']>('streaming');
  const [territory, setTerritory] = useState('worldwide');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Connect the Knowledge Core to manage enterprise production.');

  const refresh = async () => {
    if (!project) return;
    const [nextCollaborators, nextReleases] = await Promise.all([
      fetchCollaborators(project.id),
      fetchCommercialReleases(project.id),
    ]);
    setCollaborators(nextCollaborators);
    setReleases(nextReleases);
    setMessage(`Loaded ${nextCollaborators.length} collaborators and ${nextReleases.length} commercial release plans.`);
  };

  useEffect(() => { void refresh(); }, [project?.id]);

  const activeCollaborators = collaborators.filter((item) => item.status === 'active').length;
  const plannedReleases = releases.filter((item) => ['planning','submitted','approved','scheduled'].includes(item.status)).length;
  const canonAssets = useMemo(() => assets.filter((asset) => asset.status === 'canon').length, [assets]);

  const invite = async () => {
    if (!project || !email.trim()) return;
    setBusy(true);
    try {
      await inviteCollaborator(project.id, email, role);
      setEmail('');
      await refresh();
      setMessage('Collaborator invitation recorded.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Collaborator could not be invited.');
    } finally { setBusy(false); }
  };

  const createRelease = async () => {
    if (!project || !releaseTitle.trim()) return;
    setBusy(true);
    try {
      await createCommercialRelease(project.id, releaseTitle.trim(), releaseType, territory.trim());
      await refresh();
      setMessage('Commercial release plan created.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Commercial release plan could not be created.');
    } finally { setBusy(false); }
  };

  const snapshot = async () => {
    if (!project) return;
    setBusy(true);
    try {
      const [scenes, jobs] = await Promise.all([fetchScenes(project.id), fetchRenderJobs(project.id)]);
      await createAnalyticsSnapshot(project.id, {
        assets: assets.length,
        canon_assets: canonAssets,
        scenes: scenes.length,
        passing_scenes: scenes.filter((scene) => scene.canonValidation.status === 'passed').length,
        render_jobs: jobs.length,
        successful_render_jobs: jobs.filter((job) => job.status === 'succeeded').length,
        collaborators: collaborators.length,
        commercial_releases: releases.length,
      });
      setMessage('Daily production analytics snapshot saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Analytics snapshot could not be saved.');
    } finally { setBusy(false); }
  };

  return (
    <section className="space-y-6" aria-labelledby="enterprise-studio-heading">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">Release 7 · Enterprise Film OS</p><h2 id="enterprise-studio-heading" className="mt-2 text-3xl font-bold">Studio Portfolio + Commercial Control</h2></div>
        <Button type="button" disabled={!project || busy} onClick={() => void snapshot()}><BarChart3 className="mr-2 h-4 w-4" />Save Analytics Snapshot</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Collaborators</p><p className="mt-2 text-2xl font-bold">{collaborators.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Active collaborators</p><p className="mt-2 text-2xl font-bold">{activeCollaborators}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Commercial plans</p><p className="mt-2 text-2xl font-bold">{releases.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">In pipeline</p><p className="mt-2 text-2xl font-bold">{plannedReleases}</p></Card>
      </div>

      <Card className="border-primary/20 p-4 text-sm text-muted-foreground" role="status" aria-live="polite">{message}</Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" /><h3 className="text-xl font-bold">Collaboration</h3></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
            <label htmlFor="collaborator-email" className="text-sm font-medium">Email<Input id="collaborator-email" className="mt-2" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="reviewer@example.com" /></label>
            <label className="text-sm font-medium">Role<select className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2" value={role} onChange={(event) => setRole(event.target.value as Collaborator['role'])}>{['producer','director','writer','editor','reviewer','viewer'].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <Button type="button" disabled={!project || busy || !email.trim()} onClick={() => void invite()}>Invite</Button>
          </div>
          <div className="mt-4 space-y-2">{collaborators.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border p-3"><span className="text-sm">{item.email || 'Connected user'}</span><div className="flex gap-2"><Badge variant="outline">{item.role}</Badge><Badge variant="secondary">{item.status}</Badge></div></div>)}</div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2"><BriefcaseBusiness className="h-5 w-5 text-primary" /><h3 className="text-xl font-bold">Commercial Release</h3></div>
          <label htmlFor="commercial-title" className="mt-4 block text-sm font-medium">Title<Input id="commercial-title" className="mt-2" value={releaseTitle} onChange={(event) => setReleaseTitle(event.target.value)} /></label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">Release type<select className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2" value={releaseType} onChange={(event) => setReleaseType(event.target.value as CommercialRelease['releaseType'])}>{['festival','streaming','theatrical','broadcast','direct','licensing'].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label htmlFor="commercial-territory" className="text-sm font-medium">Territory<Input id="commercial-territory" className="mt-2" value={territory} onChange={(event) => setTerritory(event.target.value)} /></label>
          </div>
          <Button className="mt-4" type="button" disabled={!project || busy || !releaseTitle.trim()} onClick={() => void createRelease()}>Create Commercial Plan</Button>
          <div className="mt-4 space-y-2">{releases.map((item) => <div key={item.id} className="rounded-xl border p-3"><div className="flex items-center justify-between"><span className="font-medium">{item.title}</span><Badge variant="outline">{item.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{item.releaseType} · {item.territory}</p></div>)}</div>
        </Card>
      </div>
    </section>
  );
}
