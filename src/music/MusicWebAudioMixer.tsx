import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Pause, Play, Download } from 'lucide-react';

export type AudioStem = { id: string; name: string; buffer: AudioBuffer; muted: boolean; solo: boolean; gain: number };
export const stemGain = (stem: Pick<AudioStem, 'muted' | 'solo' | 'gain'>, anySolo: boolean) =>
  stem.muted || (anySolo && !stem.solo) ? 0 : stem.gain;
export const encodeWav = (channels: Float32Array[], sampleRate: number): Blob => {
  const frames = channels[0]?.length ?? 0;
  const output = new ArrayBuffer(44 + frames * 2 * channels.length);
  const view = new DataView(output);
  const ascii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  ascii(0, 'RIFF'); view.setUint32(4, output.byteLength - 8, true);
  ascii(8, 'WAVE'); ascii(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels.length, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels.length * 2, true);
  view.setUint16(32, channels.length * 2, true); view.setUint16(34, 16, true);
  ascii(36, 'data'); view.setUint32(40, frames * channels.length * 2, true);
  for (let i = 0; i < frames; i++) for (let c = 0; c < channels.length; c++) {
    const value = Math.max(-1, Math.min(1, channels[c][i] ?? 0));
    view.setInt16(44 + (i * channels.length + c) * 2, value < 0 ? value * 32768 : value * 32767, true);
  }
  return new Blob([output], { type: 'audio/wav' });
};

const MAX_BYTES = 100 * 1024 * 1024;
const format = (value: number) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
export default function MusicWebAudioMixer() {
  const [stems, setStems] = useState<AudioStem[]>([]);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const gainsRef = useRef<Map<string, GainNode>>(new Map());
  const startRef = useRef(0);
  const offsetRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const playingRef = useRef(false);
  const decodeGenerationRef = useRef(0);
  const duration = stems.length ? Math.min(...stems.map(s => s.buffer.duration)) : 0;
  const anySolo = stems.some(s => s.solo);

  const stop = () => {
    sourcesRef.current.forEach(source => { try { source.stop(); } catch { /* source may have ended */ } source.disconnect(); });
    sourcesRef.current = [];
    gainsRef.current.forEach(node => node.disconnect());
    gainsRef.current.clear();
    playingRef.current = false;
    setPlaying(false);
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  };
  useEffect(() => () => {
    decodeGenerationRef.current += 1;
    sourcesRef.current.forEach(s => { try { s.stop(); } catch { /* already stopped */ } s.disconnect(); });
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    void ctxRef.current?.close();
  }, []);
  useEffect(() => {
    stems.forEach(s => {
      const gain = gainsRef.current.get(s.id);
      if (gain && ctxRef.current) gain.gain.setTargetAtTime(stemGain(s, anySolo), ctxRef.current.currentTime, .008);
    });
  }, [stems, anySolo]);

  const tick = () => {
    const ctx = ctxRef.current;
    if (!ctx || !playingRef.current) return;
    const next = offsetRef.current + ctx.currentTime - startRef.current;
    if (next >= duration) { stop(); offsetRef.current = 0; setTime(0); return; }
    setTime(next);
    frameRef.current = requestAnimationFrame(tick);
  };
  const pause = () => {
    const ctx = ctxRef.current;
    if (ctx && playingRef.current) offsetRef.current = Math.min(duration, offsetRef.current + ctx.currentTime - startRef.current);
    stop();
    setTime(offsetRef.current);
  };
  const toggle = async () => {
    if (!stems.length || exporting) return;
    if (playingRef.current) { pause(); return; }
    try {
      const ctx = ctxRef.current ?? new AudioContext();
      ctxRef.current = ctx;
      await ctx.resume();
      const beginning = Math.min(offsetRef.current, Math.max(0, duration - .001));
      offsetRef.current = beginning;
      const startAt = ctx.currentTime + .04;
      const created: AudioBufferSourceNode[] = [];
      const nodes = new Map<string, GainNode>();
      try {
        for (const stem of stems) {
          const source = ctx.createBufferSource();
          source.buffer = stem.buffer;
          const gain = ctx.createGain();
          gain.gain.value = stemGain(stem, anySolo);
          source.connect(gain).connect(ctx.destination);
          created.push(source);
          nodes.set(stem.id, gain);
        }
        created.forEach(source => source.start(startAt, beginning));
      } catch (cause) {
        created.forEach(source => { try { source.stop(); } catch { /* not started */ } source.disconnect(); });
        nodes.forEach(node => node.disconnect());
        throw cause;
      }
      sourcesRef.current = created;
      gainsRef.current = nodes;
      startRef.current = startAt;
      playingRef.current = true;
      setPlaying(true);
      frameRef.current = requestAnimationFrame(tick);
    } catch { setError('Audio playback could not be started.'); }
  };
  const seek = (next: number) => {
    const wasPlaying = playingRef.current;
    stop();
    offsetRef.current = next;
    setTime(next);
    // Resume requires a user gesture; do not automatically resume after an asynchronous failure.
    if (wasPlaying) setError('Position changed. Press Play to resume.');
  };
  const load = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    pause();
    const generation = ++decodeGenerationRef.current;
    setError('');
    try {
      const ctx = ctxRef.current ?? new AudioContext();
      ctxRef.current = ctx;
      const loaded: AudioStem[] = [];
      for (const file of files) {
        if ((!file.type.startsWith('audio/') && !/\.(wav|mp3|ogg|flac|m4a)$/i.test(file.name)) || file.size > MAX_BYTES) {
          setError('Skipped an invalid or oversized audio file (100 MB per stem).');
          continue;
        }
        try {
          const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
          if (generation !== decodeGenerationRef.current) return;
          loaded.push({ id: crypto.randomUUID(), name: file.name, buffer, muted: false, solo: false, gain: 1 });
        } catch { setError('Could not decode one or more audio files.'); }
      }
      if (generation !== decodeGenerationRef.current) return;
      setStems(previous => [...previous, ...loaded]);
      if (loaded.length) { offsetRef.current = 0; setTime(0); }
    } catch { setError('Web Audio is unavailable in this browser.'); }
  };
  const change = (id: string, key: 'muted' | 'solo' | 'gain', value: boolean | number) =>
    setStems(previous => previous.map(stem => stem.id === id ? { ...stem, [key]: value } : stem));
  const exportMix = async () => {
    if (!stems.length || exporting) return;
    setExporting(true);
    setError('');
    try {
      const rate = 44100;
      const frames = Math.ceil(duration * rate);
      if (frames * 8 > 250 * 1024 * 1024) throw new Error('mix too large');
      const offline = new OfflineAudioContext(2, frames, rate);
      stems.forEach(stem => {
        const source = offline.createBufferSource();
        source.buffer = stem.buffer;
        const gain = offline.createGain();
        gain.gain.value = stemGain(stem, anySolo);
        source.connect(gain).connect(offline.destination);
        source.start(0);
      });
      const rendered = await offline.startRendering();
      const blob = encodeWav([rendered.getChannelData(0), rendered.getChannelData(1)], rate);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'd3vonn-stem-mix.wav';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch { setError('WAV export failed or exceeded the 250 MB render limit.'); }
    finally { setExporting(false); }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6 space-y-5" aria-labelledby="web-audio-mixer-title">
      <div>
        <p className="text-xs uppercase tracking-widest text-primary">Stem Studio · Web Audio preview</p>
        <h2 id="web-audio-mixer-title" className="text-xl font-semibold">Shared-Clock Stem Mixer</h2>
        <p className="text-sm text-muted-foreground">Locally decoded, aligned stems with shared-clock playback. Unmastered 44.1 kHz stereo WAV export; no server upload.</p>
      </div>
      <label className="inline-flex cursor-pointer rounded-lg border border-border px-4 py-2">
        Add audio stems
        <input type="file" multiple accept="audio/*" aria-label="Add stems to Web Audio mixer" className="sr-only" onChange={load} />
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={toggle} disabled={!stems.length || exporting} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50 inline-flex items-center gap-2">{playing ? <Pause size={16} /> : <Play size={16} />}{playing ? 'Pause mix' : 'Play mix'}</button>
        <span className="text-sm tabular-nums">{format(time)} / {format(duration)}</span>
        <button type="button" onClick={exportMix} disabled={!stems.length || exporting} className="rounded-lg border border-border px-4 py-2 disabled:opacity-50 inline-flex items-center gap-2"><Download size={16} />{exporting ? 'Rendering…' : 'Export WAV'}</button>
      </div>
      <input type="range" aria-label="Mix playhead" min={0} max={duration || 0} step={0.01} value={Math.min(time, duration)} disabled={!stems.length} className="w-full accent-primary" onChange={e => seek(Number(e.target.value))} />
      <div className="space-y-3">
        {stems.map(stem => (
          <div key={stem.id} className="rounded-lg border border-border p-4 space-y-2">
            <div className="flex flex-wrap justify-between gap-2"><span className="text-sm font-medium break-all">{stem.name}</span><span className="text-xs text-muted-foreground">{format(stem.buffer.duration)} · {stem.buffer.numberOfChannels} ch</span></div>
            <div className="flex flex-wrap gap-4 items-center">
              <label className="text-sm flex gap-2 items-center"><input type="checkbox" checked={stem.muted} onChange={e => change(stem.id, 'muted', e.target.checked)} />Mute</label>
              <label className="text-sm flex gap-2 items-center"><input type="checkbox" checked={stem.solo} onChange={e => change(stem.id, 'solo', e.target.checked)} />Solo</label>
              <label className="text-sm flex gap-2 items-center">Gain <input aria-label={`Gain ${stem.name}`} type="range" min={0} max={1.5} step={0.01} value={stem.gain} onChange={e => change(stem.id, 'gain', Number(e.target.value))} />{Math.round(stem.gain * 100)}%</label>
            </div>
          </div>
        ))}
      </div>
      {!stems.length && <p className="text-sm text-muted-foreground">Add aligned audio files to start mixing.</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
