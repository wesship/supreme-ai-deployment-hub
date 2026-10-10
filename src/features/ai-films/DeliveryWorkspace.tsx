import { useEffect, useState } from 'react';
import { Captions, PackageCheck, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { AIFilmProject } from './assetManagerService';
import {
  createExportJob,
  createSubtitleTrack,
  fetchExportJobs,
  fetchPublications,
  queuePublication,
  type ExportJob,
  type Publication,
} from './deliveryService';

type Props = { project: AIFilmProject | null };

export default function DeliveryWorkspace({ project }: Props) {
  const [exports, setExports] = useState<ExportJob[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [title, setTitle] = useState('Sovereign Signal Trailer Master');
  const [exportType, setExportType] = useState<ExportJob['exportType']>('trailer');
  const [selectedExportId, setSelectedExportId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Connect the Knowledge Core to manage exports and publishing.');

  const refresh = async () => {
    if (!project) return;
    const [nextExports, nextPublications] = await Promise.all([fetchExportJobs(project.id), fetchPublications(project.id)]);
    setExports(nextExports);
    setPublications(nextPublications);
    setMessage(`Loaded ${nextExports.length} export packages and ${nextPublications.length} publication records.`);
  };

  useEffect(() => { void refresh(); }, [project?.id]);

  const createExport = async () => {
    if (!project || !title.trim()) return;
    setBusy(true);
    try {
      const id = await createExportJob(project.id, {
        title: title.trim(),
        exportType,
        aspectRatio: exportType === 'social' ? '9:16' : '16:9',
        resolution: exportType === 'social' ? '1080x1920' : '1920x1080',
        format: 'mp4',
      });
      setSelectedExportId(id);
      await refresh();
      setMessage('Export package created in draft state.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Export package could not be created.');
    } finally { setBusy(false); }
  };

  const addEnglishSubtitles = async () => {
    if (!project || !selectedExportId) return;
    setBusy(true);
    try {
      await createSubtitleTrack(project.id, selectedExportId, 'en', 'English');
      setMessage('English WebVTT subtitle track created for review.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Subtitle track could not be created.');
    } finally { setBusy(false); }
  };

  const addPublication = async (destination: Publication['destination']) => {
    if (!project || !selectedExportId) return;
    setBusy(true);
    try {
      await queuePublication(project.id, selectedExportId, destination);
      await refresh();
      setMessage(`Draft publication record created for ${destination}. Approval is still required.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Publication record could not be created.');
    } finally { setBusy(false); }
  };

  return (
    <section className="space-y-6" aria-labelledby="delivery-workspace-heading">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">Release 6 · Delivery Cloud</p>
        <h2 id="delivery-workspace-heading" className="mt-2 text-3xl font-bold">Exports, Subtitles + Publishing</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Export packages</p><p className="mt-2 text-2xl font-bold">{exports.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Publication records</p><p className="mt-2 text-2xl font-bold">{publications.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Published</p><p className="mt-2 text-2xl font-bold">{publications.filter((item) => item.status === 'published').length}</p></Card>
      </div>

      <Card className="border-primary/20 p-4 text-sm text-muted-foreground" role="status" aria-live="polite">{message}</Card>

      <Card className="p-5">
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr_auto] lg:items-end">
          <label htmlFor="delivery-title" className="text-sm font-medium">Package title
            <Input id="delivery-title" className="mt-2" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="text-sm font-medium">Export type
            <select className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2" value={exportType} onChange={(event) => setExportType(event.target.value as ExportJob['exportType'])}>
              {['feature','episode','trailer','teaser','social','archive'].map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <Button type="button" disabled={!project || busy || !title.trim()} onClick={() => void createExport()}><PackageCheck className="mr-2 h-4 w-4" />Create Export Package</Button>
        </div>
      </Card>

      <Card className="p-5">
        <label className="text-sm font-medium">Selected export
          <select className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2" value={selectedExportId} onChange={(event) => setSelectedExportId(event.target.value)}>
            <option value="">Select an export package</option>
            {exports.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.status}</option>)}
          </select>
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={!selectedExportId || busy} onClick={() => void addEnglishSubtitles()}><Captions className="mr-2 h-4 w-4" />Add English Subtitles</Button>
          <Button type="button" disabled={!selectedExportId || busy} onClick={() => void addPublication('internal-review')}><Send className="mr-2 h-4 w-4" />Send to Internal Review</Button>
          <Button type="button" variant="outline" disabled={!selectedExportId || busy} onClick={() => void addPublication('d3vonn')}>Prepare D3VONN Release</Button>
          <Button type="button" variant="outline" disabled={!selectedExportId || busy} onClick={() => void addPublication('archive')}>Prepare Archive</Button>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {exports.map((item) => (
          <Card key={item.id} className="p-4">
            <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{item.title}</h3><p className="mt-1 text-xs text-muted-foreground">{item.exportType} · {item.aspectRatio} · {item.resolution} · {item.format}</p></div><Badge variant="outline">{item.status}</Badge></div>
          </Card>
        ))}
      </div>
    </section>
  );
}
