import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from 'react';
import { Pause, Play, Upload } from 'lucide-react';

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const formatTime = (seconds: number) => Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '0:00';

export default function MusicWaveformEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const urlRef = useRef<string | null>(null);
  const peaksRef = useRef<number[]>([]);
  const durationRef = useRef(0);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [region, setRegion] = useState<[number, number] | null>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [loop, setLoop] = useState(false);

  const paint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#101827';
    ctx.fillRect(0, 0, width, height);
    const peaks = peaksRef.current;
    for (let x = 0; x < peaks.length; x++) {
      const level = peaks[x] * height * .45;
      ctx.fillStyle = durationRef.current && x / width <= current / durationRef.current ? '#f59e0b' : '#94a3b8';
      ctx.fillRect(x, height / 2 - level, 1, Math.max(1, level * 2));
    }
    if (region && durationRef.current) {
      const a = region[0] / durationRef.current * width;
      const b = region[1] / durationRef.current * width;
      ctx.fillStyle = 'rgba(251,191,36,.22)';
      ctx.fillRect(a, 0, b - a, height);
      ctx.strokeStyle = '#fbbf24';
      ctx.strokeRect(a, .5, Math.max(0, b - a), height - 1);
    }
    if (durationRef.current) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(current / durationRef.current * width, 0, 1, height);
    }
  };

  useEffect(paint, [current, duration, region]);
  useEffect(() => () => {
    audioRef.current?.pause();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  const load = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('audio/') || file.size > MAX_FILE_BYTES) {
      setError('Choose an audio file under 100 MB.');
      return;
    }
    setError('');
    setPlaying(false);
    setRegion(null);
    setCurrent(0);
    try {
      const data = await file.arrayBuffer();
      const audioContext = new AudioContext();
      let decoded: AudioBuffer;
      try {
        decoded = await audioContext.decodeAudioData(data);
      } finally {
        await audioContext.close();
      }
      const canvasWidth = 1000;
      const samples = decoded.getChannelData(0);
      const step = Math.max(1, Math.ceil(samples.length / canvasWidth));
      const peaks = Array.from({ length: canvasWidth }, (_, x) => {
        let peak = 0;
        for (let i = x * step; i < Math.min(samples.length, (x + 1) * step); i++) {
          peak = Math.max(peak, Math.abs(samples[i]));
        }
        return peak;
      });
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(file);
      urlRef.current = url;
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.load();
      }
      peaksRef.current = peaks;
      durationRef.current = decoded.duration;
      setDuration(decoded.duration);
      setFileName(file.name);
    } catch {
      setError('This audio file could not be decoded. Try WAV or MP3.');
    }
  };

  const position = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return Math.min(duration, Math.max(0, (event.clientX - rect.left) / rect.width * duration));
  };
  const pointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!duration) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const time = position(event);
    setDragStart(time);
    setRegion([time, time]);
  };
  const pointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (dragStart === null) return;
    const time = position(event);
    setRegion([Math.min(dragStart, time), Math.max(dragStart, time)]);
  };
  const pointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (dragStart === null) return;
    const time = position(event);
    if (Math.abs(time - dragStart) < .08) {
      setRegion(null);
      if (audioRef.current) audioRef.current.currentTime = time;
      setCurrent(time);
    }
    setDragStart(null);
  };
  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio || !fileName) return;
    if (!audio.paused) { audio.pause(); return; }
    if (region && (audio.currentTime < region[0] || audio.currentTime >= region[1])) {
      audio.currentTime = region[0];
    }
    try { await audio.play(); } catch { setError('Playback was blocked or failed.'); }
  };
  const tick = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (region && region[1] > region[0] && audio.currentTime >= region[1]) {
      if (loop) audio.currentTime = region[0];
      else { audio.pause(); audio.currentTime = region[0]; }
    }
    setCurrent(audio.currentTime);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-5" aria-labelledby="music-waveform-heading">
      <div>
        <p className="text-xs font-semibold tracking-[0.16em] uppercase text-primary">Stem Studio · Preview gate</p>
        <h2 id="music-waveform-heading" className="text-2xl font-semibold mt-2">Waveform Editor</h2>
        <p className="text-sm text-muted-foreground mt-2">Private browser preview. Load a local recording, drag to mark a region, and loop playback. No upload or separation is performed.</p>
      </div>
      <label className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 cursor-pointer hover:bg-muted">
        <Upload className="h-4 w-4" /> Select audio
        <input type="file" accept="audio/*" className="sr-only" onChange={load} aria-label="Choose audio file" />
      </label>
      <p className="text-sm text-muted-foreground" aria-live="polite">{fileName || 'No recording selected'}</p>
      <canvas ref={canvasRef} width={1000} height={160} role="img" aria-label="Audio waveform. Drag to select a playback region." className="w-full rounded-lg border border-border touch-none cursor-crosshair" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => setDragStart(null)} />
      <audio ref={audioRef} onTimeUpdate={tick} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
      <div className="flex items-center flex-wrap gap-4">
        <button type="button" disabled={!fileName} onClick={togglePlayback} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 disabled:opacity-50 inline-flex items-center gap-2">
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} {playing ? 'Pause' : 'Play'}
        </button>
        <span className="text-sm tabular-nums">{formatTime(current)} / {formatTime(duration)}</span>
        <label className="text-sm inline-flex items-center gap-2">
          <input type="checkbox" checked={loop} onChange={e => setLoop(e.target.checked)} /> Loop selected region
        </label>
        <button type="button" onClick={() => setRegion(null)} disabled={!region} className="text-sm underline disabled:opacity-50">Clear selection</button>
      </div>
      <p className="text-xs text-muted-foreground">{region ? `Selection: ${formatTime(region[0])} – ${formatTime(region[1])}` : 'Drag across the waveform to mark a region.'}</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
