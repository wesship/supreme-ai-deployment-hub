import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleStop, Clock3, Loader2, Music2, Play, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const MUSIC_FUNCTION = 'music-generate';
const ACTIVE_STATUSES = ['queued', 'provisioning', 'running', 'post_processing', 'uploading', 'retrying'];
const DEMO_TRACKS = [
  { title: 'Duru Rondo', mood: 'Original / upbeat', src: 'https://raw.githubusercontent.com/uncle-sheepsky/duru-ai-cc0-bgm/main/mp3/duru-rondo.mp3' },
  { title: 'Duru Roomscene Lofi', mood: 'Original / lofi', src: 'https://raw.githubusercontent.com/uncle-sheepsky/duru-ai-cc0-bgm/main/mp3/duru-roomscene-lofi.mp3' },
  { title: 'Duru Rhythm Fever', mood: 'Original / electronic', src: 'https://raw.githubusercontent.com/uncle-sheepsky/duru-ai-cc0-bgm/main/mp3/duru-rhythm-fever.mp3' },
];

type JobStatus = 'queued' | 'provisioning' | 'running' | 'post_processing' | 'uploading' | 'succeeded' | 'failed' | 'cancelled' | 'retrying';
type Job = {
  id: string;
  status: JobStatus;
  prompt: string;
  title?: string;
  provider_display_name?: string;
  model_name?: string;
  model_version?: string | null;
  audio_url?: string | null;
  error_message?: string | null;
  failure_reason?: string | null;
  qa_result?: { status?: string } | null;
};
type ProviderHealth = {
  status?: string;
  gpu_online?: boolean | null;
  gpu_name?: string | null;
  vram_total_mb?: number | null;
  queue_depth?: number | null;
  model_loaded?: boolean | null;
  api_latency_ms?: number | null;
  last_successful_generation_at?: string | null;
};
type Provider = {
  provider_key: string;
  display_name: string;
  default_model: string;
  default_model_version?: string | null;
  technical_status: string;
  license_review_status: string;
  dispatch_allowed: boolean;
  health?: ProviderHealth | null;
};

const statusLabel = (status: JobStatus) => status.replace('_', ' ');
const isActive = (status?: JobStatus) => Boolean(status && ACTIVE_STATUSES.includes(status));

const Music = () => {
  const [prompt, setPrompt] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [genre, setGenre] = useState('');
  const [bpm, setBpm] = useState(120);
  const [duration, setDuration] = useState(90);
  const [vocalLanguage, setVocalLanguage] = useState('en');
  const [instrumental, setInstrumental] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const providerReady = Boolean(provider?.dispatch_allowed);
  const providerHealth = provider?.health;
  const policyText = useMemo(() => {
    if (!provider) return 'Checking the hosted-provider policy gate.';
    if (providerReady) return `${provider.display_name} is approved for hosted generation.`;
    return `${provider.display_name} remains blocked pending hosted and commercial policy approval.`;
  }, [provider, providerReady]);

  useEffect(() => {
    let active = true;
    const loadHealth = async () => {
      const { data, error } = await supabase.functions.invoke(MUSIC_FUNCTION, { body: { action: 'health' } });
      if (!active || error) return;
      const first = (data?.providers ?? [])[0] as Provider | undefined;
      setProvider(first ?? null);
    };
    void loadHealth();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!job || !isActive(job.status)) return;
    let cancelled = false;
    const poll = async () => {
      const { data, error } = await supabase.functions.invoke(MUSIC_FUNCTION, { body: { action: 'status', job_id: job.id } });
      if (cancelled) return;
      if (error) {
        setMessage(error.message);
        return;
      }
      const updated = data?.job as Job | undefined;
      if (!updated) return;
      setJob(updated);
      if (updated.status === 'failed') setMessage(updated.error_message || 'Generation failed.');
      if (updated.status === 'cancelled') setMessage('Generation cancelled.');
      if (updated.status === 'succeeded') setMessage('Audio QA passed and the mastered track was saved to your private library.');
    };
    const id = window.setInterval(poll, 2500);
    void poll();
    return () => { cancelled = true; window.clearInterval(id); };
  }, [job?.id, job?.status]);

  const generate = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setJob(null);
    const { data, error } = await supabase.functions.invoke(MUSIC_FUNCTION, {
      body: {
        action: 'submit',
        title: prompt.slice(0, 80),
        prompt: genre ? `${genre}. ${prompt}` : prompt,
        lyrics: instrumental ? '' : lyrics,
        genre,
        bpm,
        duration,
        vocal_language: vocalLanguage,
        instrumental,
        audio_format: 'mp3',
      },
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (!data?.job) {
      setMessage(data?.error || 'The music request could not be queued.');
      return;
    }
    setJob(data.job as Job);
    setMessage('Generation queued for the secure provider worker.');
  };

  const cancel = async () => {
    if (!job || !isActive(job.status)) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke(MUSIC_FUNCTION, { body: { action: 'cancel', job_id: job.id } });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (data?.job) setJob(data.job as Job);
  };

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-slate-950 px-4 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-start gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><Music2 className="h-7 w-7" /></div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.25em] text-blue-300">D3VONN.IO Music Studio</p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Music Generator</h1>
            <p className="mt-2 max-w-2xl text-slate-300">Create an original track with reproducible generation metadata, staged audio QA, and private-library storage.</p>
          </div>
        </header>

        <section className={`mb-6 rounded-2xl border p-5 ${providerReady ? 'border-emerald-400/20 bg-emerald-400/5' : 'border-amber-400/20 bg-amber-400/5'}`} aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex gap-3">
              {providerReady ? <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-300" /> : <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" />}
              <div>
                <h2 className="font-semibold">Provider policy gate</h2>
                <p className="mt-1 text-sm text-slate-300">{policyText}</p>
              </div>
            </div>
            <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-xs text-slate-300">{provider?.license_review_status ?? 'pending review'}</span>
          </div>
          {providerHealth && <div className="mt-4 grid gap-2 text-xs text-slate-300 sm:grid-cols-4"><span>GPU: {providerHealth.gpu_online ? providerHealth.gpu_name || 'online' : 'not connected'}</span><span>Model: {providerHealth.model_loaded ? 'loaded' : 'not loaded'}</span><span>Queue: {providerHealth.queue_depth ?? '—'}</span><span>API: {providerHealth.api_latency_ms ? `${providerHealth.api_latency_ms} ms` : '—'}</span></div>}
        </section>

        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Real music previews</h2><p className="mt-1 text-xs text-slate-400">CC0 tracks remain available while hosted inference is awaiting approval.</p></div><span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">CC0 demo audio</span></div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">{DEMO_TRACKS.map((track) => <article key={track.src} className="rounded-xl border border-white/10 bg-slate-900/80 p-4"><div className="flex items-center gap-3"><div className="rounded-lg bg-white/10 p-2"><Play className="h-4 w-4" /></div><div className="min-w-0"><p className="truncate text-sm font-medium">{track.title}</p><p className="text-xs text-slate-500">{track.mood}</p></div></div><audio className="mt-3 w-full" controls preload="none" src={track.src} aria-label={`Preview ${track.title}`} /></article>)}</div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
          <form onSubmit={generate} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <label className="block text-sm font-medium">Describe your song<textarea required minLength={4} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Cinematic alt-pop, intimate verses, huge emotional chorus..." className="mt-2 min-h-32 w-full rounded-xl border border-white/10 bg-slate-900 p-4 text-sm placeholder:text-slate-500" /></label>
            <label className="mt-5 block text-sm font-medium">Lyrics<textarea disabled={instrumental} value={lyrics} onChange={(event) => setLyrics(event.target.value)} placeholder={instrumental ? 'Instrumental mode is enabled.' : '[Verse 1]\nWrite your lyrics here...'} className="mt-2 min-h-44 w-full rounded-xl border border-white/10 bg-slate-900 p-4 font-mono text-sm disabled:opacity-50" /></label>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm text-slate-300">Genre/style<input value={genre} onChange={(event) => setGenre(event.target.value)} placeholder="Pop / R&B" className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 p-3" /></label>
              <label className="text-sm text-slate-300">BPM<input type="number" min={40} max={240} value={bpm} onChange={(event) => setBpm(Number(event.target.value))} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 p-3" /></label>
              <label className="text-sm text-slate-300">Duration<input type="number" min={10} max={600} value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 p-3" /></label>
              <label className="text-sm text-slate-300">Language<select value={vocalLanguage} onChange={(event) => setVocalLanguage(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 p-3"><option value="en">English</option><option value="es">Spanish</option><option value="fr">French</option><option value="de">German</option><option value="ja">Japanese</option><option value="zh">Chinese</option></select></label>
            </div>
            <label className="mt-5 flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={instrumental} onChange={(event) => setInstrumental(event.target.checked)} /> Instrumental only</label>
            <button disabled={busy || !providerReady || isActive(job?.status)} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}{busy ? 'Submitting…' : providerReady ? 'Generate song' : 'Provider approval required'}</button>
          </form>

          <aside className="rounded-2xl border border-white/10 bg-white/[0.04] p-6"><h2 className="font-semibold">Generation status</h2><div className="mt-5 rounded-xl border border-white/10 bg-slate-900/80 p-5">{!job && <p className="text-sm text-slate-400">A queued generation and its final library record will appear here.</p>}{job && <><div className="flex items-center gap-3"><div className="rounded-full bg-white/10 p-2">{job.status === 'succeeded' ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : job.status === 'failed' || job.status === 'cancelled' ? <AlertTriangle className="h-4 w-4 text-amber-300" /> : <Loader2 className="h-4 w-4 animate-spin" />}</div><div><p className="text-sm font-medium capitalize">{statusLabel(job.status)}</p><p className="text-xs text-slate-500">Job {job.id.slice(0, 8)}{job.model_name ? ` · ${job.model_name}` : ''}</p></div></div>{job.audio_url && <audio className="mt-5 w-full" controls src={job.audio_url} preload="metadata" />}{job.status === 'succeeded' && <p className="mt-4 flex items-center gap-2 text-xs text-emerald-200"><ShieldCheck className="h-4 w-4" />{job.qa_result?.status === 'passed' ? 'Audio QA passed; mastered copy stored.' : 'Processed audio stored.'}</p>}{isActive(job.status) && <button type="button" onClick={cancel} disabled={busy} className="mt-4 inline-flex items-center gap-2 text-sm text-amber-200 disabled:opacity-50"><CircleStop className="h-4 w-4" /> Cancel generation</button>}{(job.status === 'failed' || job.status === 'cancelled') && <button type="button" onClick={() => { setJob(null); setMessage(''); }} className="mt-4 inline-flex items-center gap-2 text-sm text-blue-300"><RefreshCw className="h-4 w-4" /> Start another generation</button>}</>}</div>{message && <p className="mt-4 text-sm text-slate-400" role="status">{message}</p>}<div className="mt-6 border-t border-white/10 pt-5 text-xs leading-5 text-slate-500"><p className="flex items-center gap-2"><Clock3 className="h-4 w-4" />Lifecycle: queued, provisioning, running, post-processing, uploading, then succeeded or failed.</p></div></aside>
        </div>
      </div>
    </section>
  );
};

export default Music;
