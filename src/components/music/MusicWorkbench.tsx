import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createMusicToolJob, getStemJob, musicCapabilities, stemRequest, type MusicArtifact, type MusicTool, type StemJob } from '@/services/stemStudio';
import { downloadMusicFile, previewNotes, type MusicNote } from '@/services/musicFiles';
import RecordingWaveform, { type AudioRegion } from './RecordingWaveform';
import BeatLab from './BeatLab';

const tools: { mode: MusicTool; title: string; description: string }[] = [
  { mode: 'analyze', title: 'Analyze tempo & key', description: 'Estimate BPM, beat positions, and musical key.' },
  { mode: 'trim', title: 'Trim selected region', description: 'Render your selected region on the worker.' },
  { mode: 'midi', title: 'Convert audio to MIDI', description: 'Extract editable notes. Use an isolated instrument for better results.' },
  { mode: 'transcribe', title: 'Transcribe & caption', description: 'Draft text, word timestamps, and SRT captions. Review singing carefully.' },
  { mode: 'clean_speech', title: 'Clean spoken voice', description: 'Reduce noise in speech, interviews, or radio announcements.' },
  { mode: 'loudness', title: 'Measure & normalize loudness', description: 'Measure LUFS and apply gain with sample-peak headroom.' },
  { mode: 'separate_advanced', title: 'Alternative stem model', description: 'Run the operator-qualified Audio Separator model.' },
];

export default function MusicWorkbench() {
  const [account, setAccount] = useState<string | null>(null);
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setAccount(session?.user.id ?? null));
    return () => subscription.unsubscribe();
  }, []);
  return <Workbench key={account ?? 'signed-out'} />;
}

function Workbench() {
  const [file, setFile] = useState<File | null>(null);
  const [selection, setSelection] = useState<AudioRegion | null>(null);
  const [capabilities, setCapabilities] = useState<MusicTool[]>([]);
  const [availability, setAvailability] = useState('Checking recording tools…');
  const [mode, setMode] = useState<MusicTool>('analyze');
  const [rights, setRights] = useState(false);
  const [target, setTarget] = useState(-14);
  const [job, setJob] = useState<StemJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<unknown>(null);
  const [beats, setBeats] = useState<number[]>([]);
  const [notes, setNotes] = useState<MusicNote[] | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const releases = useRef<(() => void)[]>([]);
  const audioUrls = useRef<string[]>([]);
  const active = busy || job?.status === 'queued' || job?.status === 'processing';

  useEffect(() => {
    mounted.current = true;
    const fileReleases = releases.current;
    const controller = new AbortController();
    void musicCapabilities(controller.signal).then(data => {
      if (controller.signal.aborted) return;
      setCapabilities(data.enabled ? data.tools : []);
      setAvailability(data.enabled ? 'Worker tools require individual qualification. Browser waveform and instruments work independently.' : 'Worker processing is awaiting configuration. Browser waveform and instruments are available.');
    }).catch(reason => { if (!controller.signal.aborted) setAvailability(reason.message); });
    return () => { mounted.current = false; controller.abort(); request.current?.abort(); fileReleases.forEach(release => release()); audioUrls.current.forEach(url => URL.revokeObjectURL(url)); };
  }, []);

  const jobId = job?.id;
  const jobStatus = job?.status;
  useEffect(() => {
    if (!jobId || !['queued', 'processing'].includes(jobStatus ?? '')) return;
    const controller = new AbortController();
    let timer: number;
    const poll = async () => {
      try {
        const next = await getStemJob(jobId, controller.signal);
        if (controller.signal.aborted) return;
        setJob(next); setError('');
        if (['queued', 'processing'].includes(next.status)) timer = window.setTimeout(() => void poll(), 3000);
      } catch (reason) {
        if (!controller.signal.aborted) { setError(reason instanceof Error ? reason.message : 'Job status unavailable.'); timer = window.setTimeout(() => void poll(), 10000); }
      }
    };
    timer = window.setTimeout(() => void poll(), 3000);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [jobId, jobStatus]);

  const submit = async () => {
    if (!file || !rights || !capabilities.includes(mode)) return;
    setBusy(true); setError(''); setJob(null); setReport(null); setAudioUrl(null);
    audioUrls.current.forEach(url => URL.revokeObjectURL(url)); audioUrls.current = [];
    const controller = new AbortController(); request.current = controller;
    const options: Record<string, number> = mode === 'trim' && selection ? { start_seconds: selection.start, end_seconds: selection.end } : mode === 'loudness' ? { target_lufs: target } : {};
    try { const next = await createMusicToolJob(file, mode, options, controller.signal); if (mounted.current) setJob(next); }
    catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : 'Could not submit recording.'); }
    finally { if (mounted.current) setBusy(false); }
  };

  const readArtifact = async (artifact: MusicArtifact, action: 'download' | 'view' | 'notes' | 'preview') => {
    if (!job) return;
    setBusy(true); setError('');
    const controller = new AbortController(); request.current = controller;
    try {
      const path = action === 'preview'
        ? `/jobs/${job.id}/audio/${encodeURIComponent(artifact.name)}?preview=true`
        : `/jobs/${job.id}/artifacts/${encodeURIComponent(artifact.name)}`;
      const response = await stemRequest(path, { signal: controller.signal });
      if (action === 'view' || action === 'notes') {
        const data: unknown = await response.json();
        if (controller.signal.aborted) return;
        if (action === 'notes') { const selected = previewNotes(data); if (!selected.length) throw new Error('No playable notes found in the first 30 seconds.'); setNotes(selected); }
        else {
          setReport(data);
          if (data && typeof data === 'object' && Array.isArray((data as { beat_seconds?: unknown }).beat_seconds)) {
            setBeats((data as { beat_seconds: unknown[] }).beat_seconds.filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 600));
          }
        }
      } else {
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        if (action === 'preview') { audioUrls.current.forEach(url => URL.revokeObjectURL(url)); const url = URL.createObjectURL(blob); audioUrls.current = [url]; setAudioUrl(url); }
        else { const release = downloadMusicFile(blob, artifact.filename); releases.current.push(release); window.setTimeout(release, 60000); }
      }
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : 'Could not load result.'); }
    finally { if (mounted.current) setBusy(false); }
  };

  const button = 'rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring';
  return <div className="space-y-8">
    <section aria-labelledby="recording-tools-heading" className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-5">
      <div><p className="text-xs uppercase tracking-[0.2em] text-primary">Analyze · Edit · Prepare</p><h2 id="recording-tools-heading" className="mt-2 text-2xl font-semibold">Recording Tools</h2><p className="mt-2 text-sm text-muted-foreground">Select your own recording to explore its waveform, export a selection, or run a qualified processing tool.</p></div>
      <p role="status" className="text-xs text-muted-foreground">{availability}</p>
      <label className="block text-sm">Workbench recording<input className="block w-full mt-2 rounded-lg border border-border p-3" type="file" accept=".wav,.mp3,.flac,.m4a,.ogg" disabled={!!active} onChange={event => {
        const next = event.target.files?.[0] ?? null;
        setFile(null); setRights(false); setBeats([]); setSelection(null); setError(''); setReport(null); setJob(null); setAudioUrl(null);
        audioUrls.current.forEach(url => URL.revokeObjectURL(url)); audioUrls.current = [];
        if (next && next.size > 50 * 1024 * 1024) setError('Maximum upload is 50 MiB.'); else setFile(next);
      }} /></label>
      {file && <RecordingWaveform file={file} onRegion={setSelection} beats={beats} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{tools.map(tool => <button key={tool.mode} type="button" disabled={!!active || !capabilities.includes(tool.mode)} aria-pressed={mode === tool.mode} onClick={() => setMode(tool.mode)} className={`rounded-xl border p-4 text-left disabled:opacity-55 focus-visible:ring-2 focus-visible:ring-ring ${mode === tool.mode ? 'border-primary bg-primary/10' : 'border-border'}`}>
        <span className="block font-medium">{tool.title}</span><span className="block mt-1 text-xs text-muted-foreground">{tool.description}</span>{!capabilities.includes(tool.mode) && <span className="block mt-2 text-xs text-muted-foreground">Awaiting worker qualification</span>}
      </button>)}</div>
      {mode === 'loudness' && <label className="block text-sm">Target loudness (LUFS)<input aria-label="Target LUFS" className="ml-2 w-20 rounded border border-border bg-background p-2" type="number" min="-30" max="-8" value={target} disabled={!!active} onChange={event => setTarget(Math.max(-30, Math.min(-8, Number(event.target.value))))} /><span className="block mt-1 text-xs text-muted-foreground">Gain-only normalization. A -1 dBFS sample-peak ceiling may prevent reaching the target; this does not measure true peaks or perform mastering.</span></label>}
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={rights} disabled={!!active} onChange={event => setRights(event.target.checked)} />I have permission to process this workbench recording.</label>
      <button className={`${button} bg-primary text-primary-foreground`} disabled={!!active || !file || !rights || !capabilities.includes(mode) || (mode === 'trim' && !selection)} onClick={() => void submit()}>{busy ? 'Working…' : `Run ${tools.find(tool => tool.mode === mode)?.title}`}</button>
      {job && <p role="status" className="text-sm">Recording job: {job.status}. {job.status === 'completed' ? 'Private results expire after 24 hours.' : ''}</p>}
      {(error || job?.error) && <p role="alert" className="text-sm text-destructive">{error || job?.error}</p>}
      {job?.status === 'completed' && <div className="space-y-3" aria-label="Recording results">{job.artifacts?.map(artifact => <div key={artifact.name} className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/30 p-3">
        <span className="text-sm break-all">{artifact.filename}</span><button className={button} disabled={busy} onClick={() => void readArtifact(artifact, 'download')}>Download {artifact.name}</button>
        {artifact.filename.endsWith('.json') && <button className={button} disabled={busy} onClick={() => void readArtifact(artifact, 'view')}>View {artifact.name}</button>}
        {artifact.name === 'notes' && <button className={button} disabled={busy} onClick={() => void readArtifact(artifact, 'notes')}>Import into Melody Lab</button>}
        {artifact.filename.endsWith('.wav') && <button className={button} disabled={busy} onClick={() => void readArtifact(artifact, 'preview')}>Preview {artifact.name}</button>}
      </div>)}</div>}
      {audioUrl && <audio controls src={audioUrl} className="w-full" aria-label="Processed audio preview" />}
      {report !== null && <details open><summary className="cursor-pointer text-sm font-medium">Processing report</summary><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/30 p-4 mt-2 text-xs">{JSON.stringify(report, null, 2)}</pre></details>}
    </section>
    <BeatLab importedNotes={notes} />
  </div>;
}
