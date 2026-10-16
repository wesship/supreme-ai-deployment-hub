import { useEffect, useRef, useState } from 'react';
import { createStemJob, getStemJob, stemRequest, type StemJob, type StemMode } from '@/services/stemStudio';
import { API_BASE_URL } from '@/services/config';
import { supabase } from '@/integrations/supabase/client';
import type { MixerSession } from '@/music/musicMixer';

type Track = { name: string; buffer: AudioBuffer; gain: GainNode };

interface Props { onMixSession?: (session: MixerSession | null) => void }

export default function StemStudio({ onMixSession }: Props = {}) {
  const [account, setAccount] = useState<string | null>(null);
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setAccount(session?.user.id ?? null));
    return () => subscription.unsubscribe();
  }, []);
  return <StudioPanel key={account ?? 'signed-out'} onMixSession={onMixSession} />;
}

function StudioPanel({ onMixSession }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [availability, setAvailability] = useState('Checking Stem Studio availability…');
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<StemMode>('vocals');
  const [rights, setRights] = useState(false);
  const [job, setJob] = useState<StemJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playing, setPlaying] = useState(false);
  const [solo, setSolo] = useState<string | null>(null);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [position, setPosition] = useState(0);
  const context = useRef<AudioContext | null>(null);
  const sources = useRef<AudioBufferSourceNode[]>([]);
  const offset = useRef(0);
  const started = useRef(0);
  const urls = useRef<string[]>([]);
  const loadController = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const active = busy || job?.status === 'queued' || job?.status === 'processing';

  const stop = () => {
    sources.current.forEach(source => { source.onended = null; source.stop(); source.disconnect(); });
    sources.current = [];
    setPlaying(false);
  };

  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/api/music/stems/capabilities`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        setEnabled(data.enabled === true);
        setAvailability(data.enabled ? 'Private pilot · WAV, MP3, FLAC, M4A, OGG · 50 MiB / 10 minutes maximum' : 'Stem Studio is awaiting worker configuration.');
      }).catch(() => { if (!controller.signal.aborted) setAvailability('Stem Studio is currently unavailable.'); });
    return () => {
      alive.current = false;
      controller.abort();
      loadController.current?.abort();
      sources.current.forEach(source => { source.onended = null; source.stop(); });
      void context.current?.close();
      urls.current.forEach(url => URL.revokeObjectURL(url));
    };
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
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'Could not check separation status.');
          timer = window.setTimeout(() => void poll(), 10000);
        }
      }
    };
    timer = window.setTimeout(() => void poll(), 3000);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [jobId, jobStatus]);

  useEffect(() => {
    tracks.forEach(track => { track.gain.gain.value = solo && solo !== track.name ? 0 : (levels[track.name] ?? 1); });
  }, [tracks, solo, levels]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setPosition(offset.current + (context.current?.currentTime ?? 0) - started.current), 100);
    return () => window.clearInterval(timer);
  }, [playing]);

  const submit = async () => {
    if (!file || !rights) return;
    stop();
    onMixSession?.(null);
    loadController.current?.abort();
    urls.current.forEach(url => URL.revokeObjectURL(url));
    urls.current = [];
    tracks.forEach(track => track.gain.disconnect());
    setTracks([]); setSolo(null); setLevels({}); setPosition(0); offset.current = 0;
    setBusy(true); setError(''); setJob(null);
    try { const next = await createStemJob(file, mode); if (alive.current) setJob(next); }
    catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : 'Upload failed.'); }
    finally { if (alive.current) setBusy(false); }
  };

  const load = async () => {
    if (!job) return;
    setBusy(true); setError('');
    const controller = new AbortController();
    loadController.current = controller;
    const loaded: Track[] = [];
    try {
      context.current ??= new AudioContext();
      await context.current.resume();
      // Sequential decode bounds temporary buffers for longer recordings.
      for (const name of job.stems) {
        const response = await stemRequest(`/jobs/${job.id}/audio/${encodeURIComponent(name)}?preview=true`, { signal: controller.signal });
        const blob = await response.blob();
        const buffer = await context.current.decodeAudioData(await blob.arrayBuffer());
        if (controller.signal.aborted) throw new Error('Preview loading canceled.');
        const gain = context.current.createGain(); gain.connect(context.current.destination);
        loaded.push({ name, buffer, gain });
      }
      setTracks(loaded);
    } catch (reason) {
      loaded.forEach(track => track.gain.disconnect());
      urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current = [];
      if (alive.current) setError(reason instanceof Error ? reason.message : 'Could not load stems.');
    } finally { if (alive.current) setBusy(false); }
  };

  const download = async (name: string) => {
    if (!job) return;
    setBusy(true); setError('');
    const controller = new AbortController(); loadController.current = controller;
    try {
      const response = await stemRequest(`/jobs/${job.id}/audio/${encodeURIComponent(name)}`, { signal: controller.signal });
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob); urls.current.push(url);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${name}.wav`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => { URL.revokeObjectURL(url); urls.current = urls.current.filter(item => item !== url); }, 60000);
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : 'Download failed.'); }
    finally { if (alive.current) setBusy(false); }
  };

  const toggle = async () => {
    const audio = context.current;
    if (!audio || !tracks.length) return;
    if (playing) {
      offset.current += Math.max(0, audio.currentTime - started.current);
      stop(); return;
    }
    try {
      await audio.resume();
      const duration = Math.min(...tracks.map(track => track.buffer.duration));
      if (offset.current >= duration) offset.current = 0;
      const when = audio.currentTime + 0.05;
      sources.current = tracks.map(track => {
        const source = audio.createBufferSource(); source.buffer = track.buffer; source.connect(track.gain);
        source.start(when, offset.current); return source;
      });
      started.current = when;
      sources.current[0].onended = () => { stop(); offset.current = 0; setPosition(0); };
      setPlaying(true);
    } catch { stop(); setError('Playback could not start. Try loading a shorter recording.'); }
  };

  const button = 'rounded-lg border border-border px-4 py-2 font-medium disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring';
  return (
    <section aria-labelledby="stem-studio-heading" className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-5">
      <div><p className="text-xs uppercase tracking-[0.2em] text-primary">Produce · Separate · Remix</p>
        <h2 id="stem-studio-heading" className="mt-2 text-2xl font-semibold">Stem Studio</h2>
        <p className="text-muted-foreground mt-2">Extract vocals or split a recording into vocals, drums, bass, and other instruments.</p>
        <p className="text-xs text-muted-foreground mt-2" role="status">{availability}</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">Recording
          <input className="block w-full rounded-lg border border-border p-3" type="file" accept=".wav,.mp3,.flac,.m4a,.ogg" disabled={!enabled || !!active}
            onChange={event => { const next = event.target.files?.[0] ?? null; setFile(null); setError(''); if (next && next.size > 50 * 1024 * 1024) setError('Maximum upload is 50 MiB.'); else setFile(next); }} /></label>
        <label className="space-y-2 text-sm">Separation
          <select value={mode} disabled={!enabled || !!active} onChange={event => setMode(event.target.value as StemMode)} className="block w-full rounded-lg border border-border bg-background p-3">
            <option value="vocals">Vocals + instrumental</option><option value="four_stems">Vocals + drums + bass + other</option>
          </select></label>
      </div>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={rights} disabled={!!active} onChange={event => setRights(event.target.checked)} />I have permission to process this recording.</label>
      <button className={`${button} bg-primary text-primary-foreground`} disabled={!enabled || !file || !rights || !!active} onClick={() => void submit()}>{busy ? 'Working…' : 'Separate recording'}</button>
      {job && <div role="status" className="rounded-lg border border-border p-4 text-sm">Separation: {job.status}. {job.status === 'completed' ? 'Your stems are ready. Results expire after 24 hours.' : job.status === 'queued' ? 'Waiting for the processing worker.' : ''}</div>}
      {(error || job?.error) && <p role="alert" className="text-sm text-destructive">{error || job?.error}</p>}
      {job?.status === 'completed' && !tracks.length && <button className={button} disabled={busy} onClick={() => void load()}>Load 30-second stem previews</button>}
      {job?.status === 'completed' && <div className="flex flex-wrap gap-3" aria-label="Full stem downloads">
        {job.stems.map(name => <button key={name} disabled={busy} onClick={() => void download(name)} className={button}>Download {name === 'no_vocals' ? 'instrumental' : name} WAV</button>)}
      </div>}
      {tracks.length > 0 && onMixSession && <button className={button} disabled={busy} onClick={() => {
        if (!job) return;
        stop();
        onMixSession({ id: job.id, label: 'Stem Studio previews · up to 30 seconds. Import full stems separately for a full-length mix.', stems: tracks.map(track => ({ id: `${job.id}:${track.name}`, name: `${track.name} preview`, buffer: track.buffer })) });
      }}>Open previews in mixer</button>}
      {tracks.length > 0 && <div className="space-y-4">
        <div className="flex flex-wrap gap-3 items-center"><button className={button} onClick={() => void toggle()}>{playing ? 'Pause stems' : 'Play stems'}</button>
          <button className={button} onClick={() => { stop(); offset.current = 0; setPosition(0); }}>Restart</button>
          <span className="text-sm tabular-nums">{Math.floor(Math.max(0, position))}s</span></div>
        {tracks.map(track => <div key={track.name} className="flex flex-wrap items-center gap-4 rounded-lg bg-muted/30 p-4">
          <span className="w-24 capitalize">{track.name === 'no_vocals' ? 'Instrumental' : track.name}</span>
          <button className={button} aria-pressed={solo === track.name} onClick={() => setSolo(solo === track.name ? null : track.name)}>Solo {track.name}</button>
          <label className="flex items-center gap-2 text-sm">Volume<input aria-label={`${track.name} volume`} type="range" min="0" max="1" step="0.01" value={levels[track.name] ?? 1} onChange={event => setLevels(previous => ({ ...previous, [track.name]: Number(event.target.value) }))} /></label>

        </div>)}
        <p className="text-xs text-muted-foreground">Playback previews cover the first 30 seconds. Separation may leave artifacts. Downloads contain the original separated stems; mixer volume does not change the exported files.</p>
      </div>}
    </section>
  );
}
