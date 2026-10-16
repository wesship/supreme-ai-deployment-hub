import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Pause, Play } from 'lucide-react';

export type StemTrack = { id: string; name: string; url: string; muted: boolean; solo: boolean; duration: number };
export const isTrackAudible = (track: Pick<StemTrack, 'muted' | 'solo'>, anySolo: boolean) =>
  !track.muted && (!anySolo || track.solo);

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const formatTime = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export default function MusicStemTimeline() {
  const [tracks, setTracks] = useState<StemTrack[]>([]);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const urlsRef = useRef<string[]>([]);
  const rafRef = useRef<number | null>(null);
  const tracksRef = useRef<StemTrack[]>([]);
  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const duration = tracks.length ? Math.min(...tracks.map(t => t.duration)) : 0;
  const anySolo = tracks.some(t => t.solo);
  tracksRef.current = tracks;

  useEffect(() => {
    const update = () => {
      if (!playingRef.current) return;
      const players = Array.from(audioRefs.current.values());
      const master = players[0];
      if (!master) { setPlaying(false); return; }
      const limit = Math.min(...tracksRef.current.map(t => t.duration));
      const next = master.currentTime;
      if (!Number.isFinite(limit) || master.ended || next >= limit) {
        playingRef.current = false;
        players.forEach(audio => { audio.pause(); audio.currentTime = 0; });
        timeRef.current = 0;
        setTime(0);
        setPlaying(false);
        return;
      }
      timeRef.current = next;
      setTime(next);
      players.slice(1).forEach(audio => {
        // Browser-media-element transport is approximate, not sample accurate.
        if (Math.abs(audio.currentTime - next) > 0.08) audio.currentTime = next;
      });
      rafRef.current = requestAnimationFrame(update);
    };
    if (playing) {
      playingRef.current = true;
      rafRef.current = requestAnimationFrame(update);
    } else {
      playingRef.current = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    }
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [playing]);

  useEffect(() => {
    const refs = audioRefs.current;
    const urls = urlsRef.current;
    return () => {
      refs.forEach(a => { a.pause(); a.removeAttribute('src'); a.load(); });
      refs.clear();
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    const solo = tracks.some(t => t.solo);
    tracks.forEach(t => {
      const audio = audioRefs.current.get(t.id);
      if (audio) audio.muted = !isTrackAudible(t, solo);
    });
  }, [tracks]);

  const addFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    if (playingRef.current) {
      audioRefs.current.forEach(a => a.pause());
      setPlaying(false);
      playingRef.current = false;
    }
    setError('');
    const added: StemTrack[] = [];
    for (const file of files) {
      if ((!file.type.startsWith('audio/') && !/\.(wav|mp3|ogg|m4a|flac)$/i.test(file.name)) || file.size > MAX_FILE_BYTES) {
        setError('Skipped an unsupported or oversized file (100 MB maximum per track).');
        continue;
      }
      const url = URL.createObjectURL(file);
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.src = url;
      try {
        const length = await new Promise<number>((resolve, reject) => {
          audio.onloadedmetadata = () => resolve(audio.duration);
          audio.onerror = () => reject(new Error('decode'));
        });
        if (!Number.isFinite(length) || length <= 0) throw new Error('duration');
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        audio.currentTime = Math.min(timeRef.current, Math.max(0, length - .001));
        audioRefs.current.set(id, audio);
        urlsRef.current.push(url);
        added.push({ id, name: file.name, url, muted: false, solo: false, duration: length });
      } catch {
        audio.removeAttribute('src');
        audio.load();
        URL.revokeObjectURL(url);
        setError('One or more files could not be loaded.');
      }
    }
    if (added.length) {
      setTracks(prev => [...prev, ...added]);
      const allDurations = [...tracksRef.current.map(t => t.duration), ...added.map(t => t.duration)];
      const maximum = Math.min(...allDurations);
      if (timeRef.current >= maximum) seek(0);
    }
  };
  const seek = (next: number) => {
    timeRef.current = next;
    setTime(next);
    audioRefs.current.forEach(a => { a.currentTime = Math.min(next, Math.max(0, a.duration - .001)); });
  };
  const toggle = async () => {
    if (!tracks.length) return;
    if (playing) {
      audioRefs.current.forEach(a => a.pause());
      setPlaying(false);
      return;
    }
    setError('');
    const players = Array.from(audioRefs.current.values());
    players.forEach(audio => { audio.currentTime = timeRef.current; });
    const result = await Promise.allSettled(players.map(audio => audio.play()));
    if (result.some(r => r.status === 'rejected')) {
      audioRefs.current.forEach(a => a.pause());
      setError('Playback could not start for every stem.');
      return;
    }
    setPlaying(true);
  };
  const updateTrack = (id: string, key: 'muted' | 'solo') =>
    setTracks(prev => prev.map(t => t.id === id ? { ...t, [key]: !t[key] } : t));

  return (
    <section aria-labelledby="stem-timeline-title" className="rounded-2xl border border-border bg-card p-6 space-y-5">
      <div>
        <p className="text-xs tracking-widest uppercase text-primary">Stem Studio · Experimental multitrack</p>
        <h2 id="stem-timeline-title" className="text-xl font-semibold">Synchronized Stem Timeline</h2>
        <p className="text-sm text-muted-foreground">Add aligned local stems. No files leave your browser. Tracks are limited to the shortest loaded duration.</p>
      </div>
      <label className="inline-flex rounded-lg border border-border px-4 py-2 cursor-pointer">
        Add aligned stems
        <input aria-label="Add aligned stem audio files" type="file" className="sr-only" accept="audio/*" multiple onChange={addFiles} />
      </label>
      <div className="flex items-center gap-3">
        <button type="button" onClick={toggle} disabled={!tracks.length} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 disabled:opacity-50 inline-flex items-center gap-2">
          {playing ? <Pause size={16} /> : <Play size={16} />} {playing ? 'Pause stems' : 'Play stems'}
        </button>
        <span className="text-sm tabular-nums">{formatTime(time)} / {formatTime(duration)}</span>
      </div>
      <input aria-label="Stem timeline position" type="range" className="w-full accent-primary" min={0} max={duration || 0} step={0.01} value={Math.min(time, duration)} disabled={!tracks.length} onChange={e => seek(Number(e.target.value))} />
      <div className="space-y-3">
        {tracks.map(track => (
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] items-center rounded-lg border border-border p-3" key={track.id}>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{track.name}</p>
              <p className="text-xs text-muted-foreground">{formatTime(track.duration)} · {isTrackAudible(track, anySolo) ? 'Audible' : 'Silent'}</p>
            </div>
            <label className="text-sm flex items-center gap-1"><input type="checkbox" checked={track.muted} onChange={() => updateTrack(track.id, 'muted')} aria-label={`Mute ${track.name}`} /> Mute</label>
            <label className="text-sm flex items-center gap-1"><input type="checkbox" checked={track.solo} onChange={() => updateTrack(track.id, 'solo')} aria-label={`Solo ${track.name}`} /> Solo</label>
          </div>
        ))}
      </div>
      {!tracks.length && <p className="text-sm text-muted-foreground">No stems added. Load tracks that start at the same musical position.</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
