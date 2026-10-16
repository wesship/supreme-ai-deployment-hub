import { useEffect, useRef, useState } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import type Regions from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { downloadMusicFile, selectionWav } from '@/services/musicFiles';

export interface AudioRegion { start: number; end: number }
const noBeats: number[] = [];
interface Props { file: File; onRegion: (region: AudioRegion | null) => void; beats?: number[] }

export default function RecordingWaveform({ file, onRegion, beats = noBeats }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const waveform = useRef<WaveSurfer | null>(null);
  const regions = useRef<ReturnType<typeof Regions.create> | null>(null);
  const callback = useRef(onRegion); callback.current = onRegion;
  const [selection, setSelection] = useState<AudioRegion | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const [duration, setDuration] = useState(0);
  const releases = useRef<(() => void)[]>([]);

  useEffect(() => {
    let disposed = false;
    setReady(false); setPlaying(false); setError(''); setSelection(null); callback.current(null);
    const initialize = async () => {
      const [{ default: WaveSurfer }, { default: Regions }] = await Promise.all([import('wavesurfer.js'), import('wavesurfer.js/dist/plugins/regions.esm.js')]);
      if (disposed || !container.current) return;
      const plugin = Regions.create(); regions.current = plugin;
      const wave = WaveSurfer.create({ container: container.current, height: 120, waveColor: '#a78bfa', progressColor: '#60a5fa', cursorColor: '#f8fafc', plugins: [plugin], normalize: true });
      waveform.current = wave;
      const select = (region: { start: number; end: number; id: string }) => {
        if (region.id.startsWith('beat-')) return;
        const value = { start: region.start, end: region.end };
        setSelection(value); callback.current(value);
        plugin.getRegions().filter(item => item.id !== region.id && !item.id.startsWith('beat-')).forEach(item => item.remove());
      };
      plugin.on('region-created', select); plugin.on('region-updated', select);
      wave.on('play', () => setPlaying(true)); wave.on('pause', () => setPlaying(false));
      await wave.loadBlob(file);
      if (disposed) return;
      const seconds = wave.getDuration();
      if (seconds > 600 || seconds <= 0) { wave.destroy(); waveform.current = null; throw new Error('Choose a recording up to 10 minutes long.'); }
      setDuration(seconds); setReady(true);
      plugin.enableDragSelection({ color: 'rgba(167,139,250,0.25)' });
      plugin.addRegion({ start: 0, end: Math.min(10, seconds), color: 'rgba(167,139,250,0.25)', minLength: 0.01 });
    };
    void initialize().catch(reason => { if (!disposed) setError(reason instanceof Error ? reason.message : 'Could not decode this recording.'); });
    return () => { disposed = true; waveform.current?.destroy(); waveform.current = null; regions.current = null; releases.current.forEach(release => release()); releases.current = []; };
  }, [file]);

  useEffect(() => {
    const plugin = regions.current;
    if (!ready || !plugin) return;
    plugin.getRegions().filter(region => region.id.startsWith('beat-')).forEach(region => region.remove());
    beats.filter(value => Number.isFinite(value) && value >= 0 && value <= duration).slice(0, 2000).forEach((beat, index) => {
      plugin.addRegion({ id: `beat-${index}`, start: beat, end: beat, drag: false, resize: false, color: 'rgba(96,165,250,0.4)' });
    });
  }, [beats, ready, duration]);

  const update = (start: number, end: number) => {
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > duration || start >= end) return;
    regions.current?.getRegions().find(region => !region.id.startsWith('beat-'))?.setOptions({ start, end });
    const value = { start, end }; setSelection(value); callback.current(value);
  };
  const exportSelection = () => {
    try {
      const buffer = waveform.current?.getDecodedData();
      if (!buffer || !selection) return;
      const release = downloadMusicFile(selectionWav(buffer, selection.start, selection.end), 'music-selection.wav');
      releases.current.push(release); window.setTimeout(release, 60000);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not export this selection.'); }
  };
  const button = 'rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring';
  return <div className="space-y-3 rounded-xl border border-border p-4">
    <div ref={container} aria-label="Recording waveform" />
    <p className="text-xs text-muted-foreground">{ready ? 'Drag across the waveform to select a region. Local playback and WAV selection export stay in your browser. Load an analysis report to overlay estimated beats.' : 'Decoding recording…'}</p>
    {ready && selection && <div className="flex flex-wrap items-center gap-3">
      <label className="text-sm">Start (seconds)<input className="ml-2 w-24 rounded border border-border bg-background p-2" type="number" min="0" max={duration} step="0.01" value={Number(selection.start.toFixed(2))} onChange={event => update(Number(event.target.value), selection.end)} /></label>
      <label className="text-sm">End (seconds)<input className="ml-2 w-24 rounded border border-border bg-background p-2" type="number" min="0" max={duration} step="0.01" value={Number(selection.end.toFixed(2))} onChange={event => update(selection.start, Number(event.target.value))} /></label>
      <button className={button} onClick={() => { if (playing) waveform.current?.pause(); else void waveform.current?.play(selection.start, selection.end).catch(() => setError('Playback could not start.')); }}>{playing ? 'Pause selection' : 'Play selection'}</button>
      <button className={button} onClick={exportSelection}>Export selection WAV</button>
    </div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
