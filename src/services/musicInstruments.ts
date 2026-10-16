import type { MusicNote } from './musicFiles';
export type BeatPattern = boolean[][];
export interface PlayingMusic { stop: () => void }

export async function startBeat(pattern: () => BeatPattern, bpm: number, onStep: (step: number) => void): Promise<PlayingMusic> {
  const Tone = await import('tone');
  await Tone.start();
  const master = new Tone.Gain(0.5).toDestination();
  const kick = new Tone.MembraneSynth({ volume: -10 }).connect(master);
  const snare = new Tone.NoiseSynth({ volume: -20, envelope: { attack: 0.001, decay: 0.12, sustain: 0 } }).connect(master);
  const hat = new Tone.MetalSynth({ volume: -25, envelope: { attack: 0.001, decay: 0.04, release: 0.01 } }).connect(master);
  let step = 0;
  const transport = Tone.getTransport(); transport.bpm.value = bpm;
  const loop = new Tone.Loop(time => {
    const current = pattern();
    if (current[0]?.[step]) kick.triggerAttackRelease('C1', '16n', time);
    if (current[1]?.[step]) snare.triggerAttackRelease('32n', time);
    if (current[2]?.[step]) hat.triggerAttackRelease('C6', '64n', time);
    const active = step; Tone.getDraw().schedule(() => onStep(active), time);
    step = (step + 1) % 16;
  }, '16n').start(0);
  transport.start();
  let stopped = false;
  return { stop: () => { if (stopped) return; stopped = true; loop.dispose(); transport.stop(); transport.position = 0; kick.dispose(); snare.dispose(); hat.dispose(); master.dispose(); } };
}

export async function auditionNotes(notes: MusicNote[], voice: 'sine' | 'triangle' | 'sawtooth'): Promise<PlayingMusic> {
  const Tone = await import('tone');
  await Tone.start();
  const synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: voice }, volume: -18 }).toDestination();
  const when = Tone.now() + 0.05;
  for (const note of notes) synth.triggerAttackRelease(Tone.Frequency(note.pitch, 'midi').toFrequency(), note.duration, when + note.start, note.velocity);
  let stopped = false;
  const stop = () => { if (!stopped) { stopped = true; synth.dispose(); } };
  const duration = Math.max(0, ...notes.map(note => note.start + note.duration));
  const timer = window.setTimeout(stop, (duration + 2) * 1000);
  return { stop: () => { window.clearTimeout(timer); stop(); } };
}
