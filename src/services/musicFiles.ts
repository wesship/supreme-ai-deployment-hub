export interface MusicNote { pitch: number; start: number; duration: number; velocity: number }

export function previewNotes(value: unknown): MusicNote[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { notes?: unknown }).notes)) throw new Error('This is not a note transcription.');
  const notes = (value as { notes: unknown[] }).notes;
  if (notes.length > 20000) throw new Error('Too many notes in this transcription.');
  return notes.filter((item): item is MusicNote => {
    if (!item || typeof item !== 'object') return false;
    const note = item as MusicNote;
    return [note.pitch, note.start, note.duration, note.velocity].every(Number.isFinite) && Number.isInteger(note.pitch) && note.pitch >= 0 && note.pitch <= 127 && note.start >= 0 && note.start < 30 && note.duration > 0 && note.velocity > 0 && note.velocity <= 1;
  }).sort((a, b) => a.start - b.start).slice(0, 512).map(note => ({ ...note, duration: Math.min(note.duration, 30 - note.start) }));
}

export function selectionWav(buffer: Pick<AudioBuffer, 'numberOfChannels' | 'sampleRate' | 'length' | 'getChannelData'>, start: number, end: number): Blob {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > buffer.length / buffer.sampleRate + 0.001) throw new Error('Select a valid audio region.');
  const from = Math.floor(start * buffer.sampleRate);
  const until = Math.min(buffer.length, Math.floor(end * buffer.sampleRate));
  const frames = until - from;
  if (frames <= 0 || frames / buffer.sampleRate > 600) throw new Error('Selection must be between one sample and 10 minutes.');
  const channels = Math.min(2, buffer.numberOfChannels);
  const bytes = new ArrayBuffer(44 + frames * channels * 2);
  const view = new DataView(bytes);
  const ascii = (offset: number, text: string) => [...text].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  ascii(0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); ascii(36, 'data'); view.setUint32(40, frames * channels * 2, true);
  const data = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  for (let i = 0; i < frames; i++) for (let channel = 0; channel < channels; channel++) {
    const sample = Math.max(-1, Math.min(1, data[channel][from + i]));
    view.setInt16(44 + (i * channels + channel) * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
  }
  return new Blob([bytes], { type: 'audio/wav' });
}

export function notesMidi(notes: MusicNote[]): Blob {
  const valid = previewNotes({ notes });
  if (!notes.length || valid.length !== notes.length) throw new Error("Use valid notes within the 30-second preview window.");
  notes = valid;
  // Type 0, 480 PPQ, explicit 120 BPM: 960 ticks per second.
  const events = notes.flatMap(note => [
    { tick: Math.round(note.start * 960), on: true, pitch: note.pitch, velocity: Math.max(1, Math.round(note.velocity * 127)) },
    { tick: Math.round((note.start + note.duration) * 960), on: false, pitch: note.pitch, velocity: 0 },
  ]).sort((a, b) => a.tick - b.tick || Number(a.on) - Number(b.on));
  const variable = (value: number) => { const bytes = [value & 127]; while ((value >>= 7) > 0) bytes.unshift((value & 127) | 128); return bytes; };
  const track: number[] = [0, 255, 81, 3, 7, 161, 32];
  let tick = 0;
  for (const event of events) { track.push(...variable(event.tick - tick), event.on ? 144 : 128, event.pitch, event.velocity); tick = event.tick; }
  track.push(0, 255, 47, 0);
  const header = [77, 84, 104, 100, 0, 0, 0, 6, 0, 0, 0, 1, 1, 224, 77, 84, 114, 107];
  const length = track.length;
  return new Blob([new Uint8Array([...header, (length >>> 24) & 255, (length >>> 16) & 255, (length >>> 8) & 255, length & 255, ...track])], { type: 'audio/midi' });
}

export function downloadMusicFile(blob: Blob, filename: string): () => void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  return () => URL.revokeObjectURL(url);
}
