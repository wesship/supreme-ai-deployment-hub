import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Pause, Play, Download } from 'lucide-react';
import { encodeWav, stemGain, measurePeak, safeMixScale, waveformBars, validateMixerInputs, metadataDuration, MIXER_MAX_TRACKS, MIXER_MAX_MEMORY, type AudioStem, type MixerSession } from './musicMixer';

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const format = (value: number) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;

export default function MusicWebAudioMixer({ session }: { session?: MixerSession | null }) {
  const [stems, setStems] = useState<AudioStem[]>([]);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [exportReport, setExportReport] = useState('');
  const [sourceLabel, setSourceLabel] = useState('Local files · export ends at the shortest loaded stem.');
  const ctxRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const gainsRef = useRef<Map<string, GainNode>>(new Map());
  const startRef = useRef(0);
  const offsetRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const playingRef = useRef(false);
  const startingRef = useRef(false);
  const decodeGeneration = useRef(0);
  const playGeneration = useRef(0);
  const exportGeneration = useRef(0);
  const loadController = useRef<AbortController | null>(null);
  const urls = useRef(new Set<string>());
  const bars = useRef(new WeakMap<AudioBuffer, number[]>());
  const duration = stems.length ? Math.min(...stems.map(stem => stem.buffer.duration)) : 0;
  const anySolo = stems.some(stem => stem.solo);
  const waveforms = useMemo(() => stems.map(stem => {
    let values = bars.current.get(stem.buffer);
    if (!values) { values = waveformBars(stem.buffer); bars.current.set(stem.buffer, values); }
    return values;
  }), [stems]);

  const stop = useCallback(() => {
    playGeneration.current++;
    sourcesRef.current.forEach(source => { try { source.stop(); } catch { /* already stopped */ } source.disconnect(); });
    sourcesRef.current = [];
    gainsRef.current.forEach(node => node.disconnect()); gainsRef.current.clear();
    playingRef.current = false; startingRef.current = false;
    setPlaying(false); setStarting(false);
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  const invalidateWork = useCallback(() => {
    decodeGeneration.current++; playGeneration.current++; exportGeneration.current++;
    loadController.current?.abort();
  }, []);

  useEffect(() => {
    const outputUrls = urls.current;
    return () => {
      invalidateWork();
      sourcesRef.current.forEach(source => { try { source.stop(); } catch { /* already stopped */ } source.disconnect(); });
      gainsRef.current.forEach(node => node.disconnect()); gainsRef.current.clear();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      void ctxRef.current?.close().catch(() => undefined); ctxRef.current = null;
      outputUrls.forEach(url => URL.revokeObjectURL(url)); outputUrls.clear();
    };
  }, [invalidateWork]);

  useEffect(() => {
    if (session === undefined) return;
    decodeGeneration.current++; exportGeneration.current++; loadController.current?.abort(); stop();
    setLoading(false); setExporting(false); setError(''); setExportReport(''); offsetRef.current = 0; setTime(0);
    if (session === null) { setStems([]); setSourceLabel('Local files · export ends at the shortest loaded stem.'); return; }
    try {
      validateMixerInputs(session.stems);
      setStems(session.stems.map(stem => ({ ...stem, muted: false, solo: false, gain: 1 })));
      setSourceLabel(session.label);
    } catch (reason) { setStems([]); setError(reason instanceof Error ? reason.message : 'Could not load mixer session.'); }
  }, [session, stop]);

  useEffect(() => {
    stems.forEach(stem => {
      const gain = gainsRef.current.get(stem.id);
      if (gain && ctxRef.current) gain.gain.setTargetAtTime(stemGain(stem, anySolo), ctxRef.current.currentTime, .008);
    });
  }, [stems, anySolo]);

  const pause = () => {
    const ctx = ctxRef.current;
    if (ctx && playingRef.current) offsetRef.current = Math.min(duration, offsetRef.current + Math.max(0, ctx.currentTime - startRef.current));
    stop(); setTime(offsetRef.current);
  };
  const toggle = async () => {
    if (!stems.length || exporting || loading || startingRef.current) return;
    if (playingRef.current) { pause(); return; }
    const ticket = ++playGeneration.current;
    startingRef.current = true; setStarting(true); setError('');
    try {
      const ctx = ctxRef.current ?? new AudioContext(); ctxRef.current = ctx;
      await ctx.resume();
      if (ticket !== playGeneration.current) return;
      if (offsetRef.current >= duration) offsetRef.current = 0;
      const beginning = offsetRef.current;
      const startAt = ctx.currentTime + .04;
      const created: AudioBufferSourceNode[] = [];
      const nodes = new Map<string, GainNode>();
      try {
        stems.forEach(stem => {
          const source = ctx.createBufferSource(); source.buffer = stem.buffer;
          const gain = ctx.createGain(); gain.gain.value = stemGain(stem, anySolo);
          source.connect(gain).connect(ctx.destination); created.push(source); nodes.set(stem.id, gain);
        });
        created.forEach(source => source.start(startAt, beginning));
      } catch (cause) {
        created.forEach(source => { try { source.stop(); } catch { /* not started */ } source.disconnect(); });
        nodes.forEach(node => node.disconnect()); throw cause;
      }
      sourcesRef.current = created; gainsRef.current = nodes; startRef.current = startAt;
      playingRef.current = true; setPlaying(true);
      const tick = () => {
        if (!playingRef.current || ticket !== playGeneration.current) return;
        const next = offsetRef.current + Math.max(0, ctx.currentTime - startAt);
        if (next >= duration) { stop(); offsetRef.current = 0; setTime(0); return; }
        setTime(next); frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
    } catch { if (ticket === playGeneration.current) setError('Audio playback could not be started.'); }
    finally { if (ticket === playGeneration.current) { startingRef.current = false; setStarting(false); } }
  };
  const seek = (next: number) => {
    if (!Number.isFinite(next)) return;
    stop(); offsetRef.current = Math.max(0, Math.min(duration, next)); setTime(offsetRef.current);
  };
  const load = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []); event.target.value = '';
    if (!files.length) return;
    pause(); loadController.current?.abort();
    const controller = new AbortController(); loadController.current = controller;
    const ticket = ++decodeGeneration.current;
    setLoading(true); setError(''); setExportReport('');
    try {
      const ctx = ctxRef.current ?? new AudioContext(); ctxRef.current = ctx;
      const loaded: AudioStem[] = [];
      if (files.length + stems.length > MIXER_MAX_TRACKS) throw new RangeError('The mixer supports up to eight stems.');
      let bytes = stems.reduce((sum, stem) => sum + stem.buffer.length * stem.buffer.numberOfChannels * 4, 0);
      for (const file of files) {
        if ((!file.type.startsWith('audio/') && !/\.(wav|mp3|ogg|flac|m4a)$/i.test(file.name)) || file.size > MAX_FILE_BYTES) throw new RangeError('Use audio files up to 100 MiB each.');
        const seconds = await metadataDuration(file, controller.signal);
        if (ticket !== decodeGeneration.current) return;
        if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 600 || bytes + seconds * ctx.sampleRate * 8 > MIXER_MAX_MEMORY) throw new RangeError('This recording exceeds the decoded-memory or 10-minute limit. Use shorter stems.');
        const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
        if (ticket !== decodeGeneration.current) return;
        const stem = { id: crypto.randomUUID(), name: file.name, buffer, muted: false, solo: false, gain: 1 };
        loaded.push(stem); validateMixerInputs([...stems, ...loaded]); bytes += buffer.length * buffer.numberOfChannels * 4;
      }
      setStems(previous => [...previous, ...loaded]); offsetRef.current = 0; setTime(0);
      setSourceLabel('Local/imported stems · export ends at the shortest loaded stem.');
    } catch (reason) { if (ticket === decodeGeneration.current) setError(reason instanceof Error ? reason.message : 'Could not decode the selected audio.'); }
    finally { if (ticket === decodeGeneration.current) setLoading(false); }
  };
  const change = (id: string, key: 'muted' | 'solo' | 'gain', value: boolean | number) => {
    setExportReport(''); setStems(previous => previous.map(stem => stem.id === id ? { ...stem, [key]: value } : stem));
  };
  const clear = () => {
    decodeGeneration.current++; exportGeneration.current++; loadController.current?.abort(); stop();
    setStems([]); setLoading(false); setExporting(false); setTime(0); offsetRef.current = 0; setExportReport(''); setError('');
  };
  const exportMix = async () => {
    if (!stems.length || exporting || loading) return;
    pause(); const ticket = ++exportGeneration.current; setExporting(true); setError('');
    try {
      const rate = 44100; const frames = Math.ceil(duration * rate);
      // Account for rendered floats, scaled copies, and the encoded stereo WAV.
      if (!frames || frames * 20 > MIXER_MAX_MEMORY) throw new RangeError('This mix exceeds the 128 MiB render working-set limit. Use a shorter selection.');
      const offline = new OfflineAudioContext(2, frames, rate);
      stems.forEach(stem => {
        const source = offline.createBufferSource(); source.buffer = stem.buffer;
        const gain = offline.createGain(); gain.gain.value = stemGain(stem, anySolo);
        source.connect(gain).connect(offline.destination); source.start(0);
      });
      const rendered = await offline.startRendering();
      if (ticket !== exportGeneration.current) return;
      const channels = [rendered.getChannelData(0), rendered.getChannelData(1)];
      const peak = measurePeak(channels); const scale = safeMixScale(peak);
      const blob = encodeWav(channels.map(channel => Float32Array.from(channel, sample => sample * scale)), rate);
      const url = URL.createObjectURL(blob); urls.current.add(url);
      const link = document.createElement('a'); link.href = url; link.download = 'd3vonn-stem-mix.wav';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => { URL.revokeObjectURL(url); urls.current.delete(url); }, 30000);
      setExportReport(`Last export: peak ${peak.toFixed(3)}; gain ${scale.toFixed(3)}; ${rendered.duration.toFixed(2)}s; stereo PCM16 WAV. Sample-peak safeguard only.`);
    } catch (reason) { if (ticket === exportGeneration.current) setError(reason instanceof Error ? reason.message : 'WAV export failed.'); }
    finally { if (ticket === exportGeneration.current) setExporting(false); }
  };
  const button = 'rounded-lg border border-border px-4 py-2 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring';
  return <section className="rounded-2xl border border-border bg-card p-6 space-y-5" aria-labelledby="web-audio-mixer-title">
    <div><p className="text-xs uppercase tracking-widest text-primary">Production mixer</p><h2 id="web-audio-mixer-title" className="text-xl font-semibold">Shared-Clock Stem Mixer</h2>
      <p className="text-sm text-muted-foreground">{sourceLabel}</p><p className="text-xs text-muted-foreground mt-1">Up to eight mono/stereo stems within 128 MiB decoded memory. Local WAV export includes mute, solo, and gain changes, with sample-peak reduction above 0.98. This does not perform loudness mastering or true-peak limiting.</p></div>
    <label className="inline-flex cursor-pointer rounded-lg border border-border px-4 py-2">Add audio stems<input type="file" multiple accept="audio/*" aria-label="Add stems to Web Audio mixer" className="sr-only" onChange={load} disabled={loading || exporting} /></label>
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => void toggle()} disabled={!stems.length || exporting || loading || starting} className={`${button} bg-primary text-primary-foreground inline-flex items-center gap-2`}>{playing ? <Pause size={16} /> : <Play size={16} />}{starting ? 'Starting…' : playing ? 'Pause mix' : 'Play mix'}</button>
      <button type="button" onClick={pause} className={button}>Stop playback</button><span className="text-sm tabular-nums">{format(time)} / {format(duration)}</span>
      <button type="button" onClick={() => void exportMix()} disabled={!stems.length || exporting || loading} className={`${button} inline-flex items-center gap-2`}><Download size={16} />{exporting ? 'Rendering…' : 'Export WAV'}</button>
      <button type="button" onClick={clear} className={button}>Clear mixer</button>
    </div>
    <input type="range" aria-label="Mix playhead" min={0} max={duration || 0} step={0.01} value={Math.min(time, duration)} disabled={!stems.length || exporting} className="w-full accent-primary" onChange={event => seek(Number(event.target.value))} />
    <div className="space-y-3">{stems.map((stem, index) => <div key={stem.id} className="rounded-lg border border-border p-4 space-y-2">
      <div className="flex flex-wrap justify-between gap-2"><span className="text-sm font-medium break-all">{stem.name}</span><span className="text-xs text-muted-foreground">{format(stem.buffer.duration)} · {stem.buffer.numberOfChannels} ch</span></div>
      <div aria-label={`Waveform preview for ${stem.name}`} role="img" className="h-12 flex items-center gap-px overflow-hidden rounded bg-muted/30">{waveforms[index].map((peak, i) => <span key={i} className="flex-1 bg-primary/70 rounded-sm" style={{ height: `${Math.max(2, peak * 95)}%` }} />)}</div>
      <div className="flex flex-wrap gap-4 items-center">
        <label className="text-sm flex gap-2 items-center"><input type="checkbox" aria-label={`Mute ${stem.name}`} checked={stem.muted} disabled={exporting} onChange={event => change(stem.id, 'muted', event.target.checked)} />Mute</label>
        <label className="text-sm flex gap-2 items-center"><input type="checkbox" aria-label={`Solo ${stem.name}`} checked={stem.solo} disabled={exporting} onChange={event => change(stem.id, 'solo', event.target.checked)} />Solo</label>
        <label className="text-sm flex gap-2 items-center">Gain<input aria-label={`Gain ${stem.name}`} type="range" min={0} max={1.5} step={0.01} value={stem.gain} disabled={exporting} onChange={event => change(stem.id, 'gain', Number(event.target.value))} />{Math.round(stem.gain * 100)}%</label>
      </div>
    </div>)}</div>
    {!stems.length && <p className="text-sm text-muted-foreground">Load Stem Studio previews or add aligned local files to start mixing.</p>}
    {loading && <p role="status" className="text-sm text-muted-foreground">Reading and decoding stems…</p>}
    {exportReport && <p role="status" className="text-xs text-muted-foreground">{exportReport}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
