import { useEffect, useRef, useState } from 'react';
import { auditionNotes, startBeat, type BeatPattern, type PlayingMusic } from '@/services/musicInstruments';
import { downloadMusicFile, notesMidi, previewNotes, type MusicNote } from '@/services/musicFiles';

const initialPattern = (): BeatPattern => [
  Array.from({ length: 16 }, (_, i) => i % 4 === 0),
  Array.from({ length: 16 }, (_, i) => i % 8 === 4),
  Array.from({ length: 16 }, (_, i) => i % 2 === 0),
];
const demoNotes: MusicNote[] = [60, 64, 67, 72].map((pitch, i) => ({ pitch, start: i * 0.5, duration: 0.4, velocity: 0.6 }));

export default function BeatLab({ importedNotes }: { importedNotes: MusicNote[] | null }) {
  const [pattern, setPattern] = useState(initialPattern);
  const patternRef = useRef(pattern); patternRef.current = pattern;
  const [bpm, setBpm] = useState(120);
  const [active, setActive] = useState<'beat' | 'melody' | null>(null);
  const [step, setStep] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState(demoNotes);
  const [voice, setVoice] = useState<'sine' | 'triangle' | 'sawtooth'>('triangle');
  const playback = useRef<PlayingMusic | null>(null);
  const generation = useRef(0);
  const done = useRef<ReturnType<typeof setTimeout>>();
  const releases = useRef<(() => void)[]>([]);

  useEffect(() => {
    if (importedNotes) {
      generation.current++; playback.current?.stop(); playback.current = null; clearTimeout(done.current);
      setActive(null); setBusy(false); setStep(-1); setNotes(importedNotes);
    }
  }, [importedNotes]);
  useEffect(() => () => { generation.current++; playback.current?.stop(); clearTimeout(done.current); releases.current.forEach(release => release()); }, []);

  const stop = () => { generation.current++; playback.current?.stop(); playback.current = null; clearTimeout(done.current); setActive(null); setBusy(false); setStep(-1); };
  const play = async (kind: 'beat' | 'melody') => {
    stop();
    const ticket = ++generation.current;
    setBusy(true); setError('');
    try {
      const valid = previewNotes({ notes });
      if (kind === 'melody' && (!notes.length || valid.length !== notes.length)) throw new Error('Use valid notes within the 30-second audition window.');
      const playing = kind === 'beat'
        ? await startBeat(() => patternRef.current, bpm, current => { if (generation.current === ticket) setStep(current); })
        : await auditionNotes(valid, voice);
      if (generation.current !== ticket) { playing.stop(); return; }
      playback.current = playing; setActive(kind); setBusy(false);
      if (kind === 'melody') done.current = setTimeout(() => { if (generation.current === ticket) stop(); }, (Math.max(...valid.map(note => note.start + note.duration)) + 2) * 1000);
    } catch (reason) { if (generation.current === ticket) { setError(reason instanceof Error ? reason.message : 'Audio could not start.'); setBusy(false); } }
  };
  const save = (blob: Blob, filename: string) => { const release = downloadMusicFile(blob, filename); releases.current.push(release); setTimeout(release, 60000); };
  const exportMidi = () => {
    const valid = previewNotes({ notes });
    if (!notes.length || valid.length !== notes.length) { setError('Correct invalid notes before exporting MIDI.'); return; }
    save(notesMidi(valid), 'edited-melody.mid');
  };
  const button = 'rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring';
  return <section aria-labelledby="beat-lab-heading" className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-5">
    <div><p className="text-xs uppercase tracking-[0.2em] text-primary">Compose in your browser</p><h2 id="beat-lab-heading" className="mt-2 text-2xl font-semibold">Beat & Melody Lab</h2><p className="mt-2 text-sm text-muted-foreground">Build a 16-step drum pattern or audition editable MIDI notes with a synthesizer. No model worker is needed for these browser tools.</p></div>
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-sm">Tempo <input aria-label="Beat tempo" className="w-20 rounded border border-border bg-background p-2" type="number" min="40" max="240" value={bpm} onChange={event => { stop(); setBpm(Math.max(40, Math.min(240, Number(event.target.value) || 120))); }} /> BPM</label>
      <button className={button} disabled={busy} onClick={() => active === 'beat' ? stop() : void play('beat')}>{active === 'beat' ? 'Stop beat' : 'Play beat'}</button>
      <button className={button} onClick={stop}>Stop all instruments</button>
      <button className={button} onClick={() => save(new Blob([JSON.stringify({ bpm, pattern })], { type: 'application/json' }), 'beat-pattern.json')}>Save beat pattern</button>
    </div>
    <div className="overflow-x-auto pb-2" aria-label="16-step drum sequencer">
      {['Kick', 'Snare', 'Hi-hat'].map((name, row) => <div key={name} className="flex items-center gap-1.5 min-w-[640px] mt-2">
        <span className="w-16 shrink-0 text-sm">{name}</span>
        {pattern[row].map((enabled, column) => <button key={column} aria-label={`${name} step ${column + 1}`} aria-pressed={enabled} onClick={() => setPattern(previous => previous.map((cells, i) => i === row ? cells.map((cell, j) => j === column ? !cell : cell) : cells))} className={`h-9 w-8 shrink-0 rounded border focus-visible:ring-2 focus-visible:ring-ring ${enabled ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border'} ${step === column ? 'ring-2 ring-foreground' : ''}`}>{column + 1}</button>)}
      </div>)}
    </div>
    <div className="border-t border-border pt-5 space-y-4">
      <h3 className="font-semibold">Melody audition</h3><p className="text-xs text-muted-foreground">{importedNotes ? 'Loaded from your transcription.' : 'Demo notes are loaded. Run audio-to-MIDI in Recording Tools to import your own.'} Audition and edited MIDI export cover up to 512 notes in the first 30 seconds. The original full transcription downloads separately.</p>
      <div className="flex flex-wrap gap-3 items-center">
        <label className="text-sm">Sound <select className="rounded border border-border bg-background p-2" value={voice} onChange={event => { stop(); setVoice(event.target.value as typeof voice); }}><option value="triangle">Soft synth</option><option value="sine">Pure tone</option><option value="sawtooth">Bright synth</option></select></label>
        <button className={button} disabled={busy || !notes.length} onClick={() => active === 'melody' ? stop() : void play('melody')}>{active === 'melody' ? 'Stop melody' : 'Play melody'}</button>
        <button className={button} disabled={!notes.length} onClick={exportMidi}>Export edited MIDI</button>
      </div>
      <div className="overflow-auto max-h-64"><table className="w-full text-sm"><caption className="text-left text-xs text-muted-foreground pb-2">Edit the first 32 notes below. MIDI pitch 60 is middle C.</caption><thead><tr>{['Note', 'MIDI pitch', 'Start (s)', 'Duration (s)'].map(title => <th key={title} className="text-left p-2">{title}</th>)}</tr></thead><tbody>
        {notes.slice(0, 32).map((note, index) => <tr key={index}><td className="p-2">{index + 1}</td>{(['pitch', 'start', 'duration'] as const).map(field => <td key={field} className="p-2"><input aria-label={`Note ${index + 1} ${field}`} className="w-20 rounded border border-border bg-background p-1" type="number" min={field === 'duration' ? 0.01 : 0} max={field === 'pitch' ? 127 : 30} step={field === 'pitch' ? 1 : 0.01} value={note[field]} onChange={event => { stop(); const value = Number(event.target.value); setNotes(previous => previous.map((item, i) => i === index ? { ...item, [field]: value } : item)); }} /></td>)}</tr>)}
      </tbody></table></div>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
