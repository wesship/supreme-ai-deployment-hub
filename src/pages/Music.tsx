import { FormEvent, useEffect, useState } from 'react';
import { Loader2, Music2, Play, RefreshCw, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const MUSIC_FUNCTION = 'music-generate';

const DEMO_TRACKS = [
  {
    title: 'Duru Rondo',
    mood: 'Original / upbeat',
    src: 'https://raw.githubusercontent.com/uncle-sheepsky/duru-ai-cc0-bgm/main/mp3/duru-rondo.mp3',
  },
  {
    title: 'Duru Roomscene Lofi',
    mood: 'Original / lofi',
    src: 'https://raw.githubusercontent.com/uncle-sheepsky/duru-ai-cc0-bgm/main/mp3/duru-roomscene-lofi.mp3',
  },
  {
    title: 'Duru Rhythm Fever',
    mood: 'Original / electronic',
    src: 'https://raw.githubusercontent.com/uncle-sheepsky/duru-ai-cc0-bgm/main/mp3/duru-rhythm-fever.mp3',
  },
];

type Job = {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  prompt: string;
  lyrics: string;
  audio_url?: string | null;
  error_message?: string | null;
};

const Music = () => {
  const [prompt, setPrompt] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [genre, setGenre] = useState('');
  const [bpm, setBpm] = useState(120);
  const [duration, setDuration] = useState(90);
  const [vocalLanguage, setVocalLanguage] = useState('en');
  const [instrumental, setInstrumental] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!job || !['queued', 'running'].includes(job.status)) return;

    let cancelled = false;
    const poll = async () => {
      const { data, error } = await supabase.functions.invoke(MUSIC_FUNCTION, {
        body: { action: 'status', job_id: job.id },
      });
      if (cancelled) return;
      if (error) {
        setMessage(error.message);
        return;
      }
      setJob(data.job);
      if (data.job?.status === 'failed') setMessage(data.job.error_message || 'Generation failed.');
      if (data.job?.status === 'succeeded') setMessage('Song generated and saved to your library.');
    };

    const id = window.setInterval(poll, 2500);
    void poll();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [job?.id, job?.status]);

  const generate = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setJob(null);

    const { data, error } = await supabase.functions.invoke(MUSIC_FUNCTION, {
      body: {
        action: 'submit',
        prompt: genre ? `${genre}. ${prompt}` : prompt,
        lyrics: instrumental ? '' : lyrics,
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
    setJob(data.job);
    setMessage('Generation queued.');
  };

  const retry = () => {
    setJob(null);
    setMessage('');
  };

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-slate-950 px-4 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-start gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <Music2 className="h-7 w-7" aria-hidden="true" />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.25em] text-blue-300">D3VONN.IO Music Studio</p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Music Generator</h1>
            <p className="mt-2 max-w-2xl text-slate-300">Create an original song from a prompt, lyrics and production controls, powered by the open-source ACE-Step engine.</p>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Real music previews</h2>
              <p className="mt-1 text-xs text-slate-400">These are actual CC0 tracks, not silent UI placeholders. They are suitable for product demos while ACE-Step inference is connected.</p>
            </div>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">CC0 demo audio</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {DEMO_TRACKS.map((track) => (
              <div key={track.src} className="rounded-xl border border-white/10 bg-slate-900/80 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-white/10 p-2"><Play className="h-4 w-4" aria-hidden="true" /></div>
                  <div className="min-w-0"><p className="truncate text-sm font-medium">{track.title}</p><p className="text-xs text-slate-500">{track.mood}</p></div>
                </div>
                <audio className="mt-3 w-full" controls preload="none" src={track.src} aria-label={`Preview ${track.title}`} />
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-slate-500">Demo source: DURU-AI CC0 music repository. CC0 permits commercial use and redistribution without required attribution. D3VONN keeps the source visible here for provenance.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
          <form onSubmit={generate} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
            <label className="block text-sm font-medium text-slate-200">Describe your song</label>
            <textarea required minLength={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Cinematic alt-pop, intimate verses, huge emotional chorus..." className="mt-2 min-h-32 w-full rounded-xl border border-white/10 bg-slate-900 p-4 text-sm outline-none ring-0 placeholder:text-slate-500 focus:border-blue-400" />

            <label className="mt-5 block text-sm font-medium text-slate-200">Lyrics</label>
            <textarea disabled={instrumental} value={lyrics} onChange={(e) => setLyrics(e.target.value)} placeholder={instrumental ? 'Instrumental mode is enabled.' : '[Verse 1]\nWrite your lyrics here...'} className="mt-2 min-h-44 w-full rounded-xl border border-white/10 bg-slate-900 p-4 font-mono text-sm outline-none placeholder:text-slate-500 focus:border-blue-400 disabled:opacity-50" />

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm text-slate-300">Genre/style<input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Pop / R&B" className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 p-3 text-sm text-white" /></label>
              <label className="text-sm text-slate-300">BPM<input type="number" min={40} max={240} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 p-3 text-sm text-white" /></label>
              <label className="text-sm text-slate-300">Duration<input type="number" min={10} max={600} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 p-3 text-sm text-white" /></label>
              <label className="text-sm text-slate-300">Language<select value={vocalLanguage} onChange={(e) => setVocalLanguage(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 p-3 text-sm text-white"><option value="en">English</option><option value="es">Spanish</option><option value="fr">French</option><option value="de">German</option><option value="ja">Japanese</option><option value="zh">Chinese</option></select></label>
            </div>

            <label className="mt-5 flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={instrumental} onChange={(e) => setInstrumental(e.target.checked)} /> Instrumental only</label>

            <button disabled={busy || !!job && ['queued', 'running'].includes(job.status)} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 py-3 font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
              {busy ? 'Submitting…' : 'Generate song'}
            </button>
          </form>

          <aside className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="font-semibold">Generation status</h2>
            <div className="mt-5 rounded-xl border border-white/10 bg-slate-900/80 p-5">
              {!job && <p className="text-sm text-slate-400">Your generated track will appear here.</p>}
              {job && <>
                <div className="flex items-center gap-3"><div className="rounded-full bg-white/10 p-2">{job.status === 'succeeded' ? <Play className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}</div><div><p className="text-sm font-medium capitalize">{job.status}</p><p className="text-xs text-slate-500">Job {job.id.slice(0, 8)}</p></div></div>
                {job.audio_url && <audio className="mt-5 w-full" controls src={job.audio_url} preload="metadata" />}
                {job.status === 'failed' && <button type="button" onClick={retry} className="mt-4 inline-flex items-center gap-2 text-sm text-blue-300"><RefreshCw className="h-4 w-4" /> Start another generation</button>}
              </>}
            </div>
            {message && <p className="mt-4 text-sm text-slate-400" role="status">{message}</p>}
            <div className="mt-6 border-t border-white/10 pt-5 text-xs leading-5 text-slate-500">Generation is asynchronous. D3VONN stores the generation parameters and resulting audio so the track can be audited and revisited later.</div>
          </aside>
        </div>
      </div>
    </section>
  );
};

export default Music;
