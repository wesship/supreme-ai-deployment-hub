import { describe, expect, it } from 'vitest';
import { notesMidi, previewNotes, selectionWav } from '@/services/musicFiles';

const read = (blob: Blob): Promise<ArrayBuffer> => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.onerror = reject; reader.readAsArrayBuffer(blob); });
const text = (bytes: ArrayBuffer, start: number, length: number) => new TextDecoder().decode(bytes.slice(start, start + length));
const note = { pitch: 60, start: 0, duration: 0.5, velocity: 0.8 };

describe('Music artifact exports', () => {
  it('exports only selected PCM frames and clamps clipping samples', async () => {
    const buffer = { numberOfChannels: 1, sampleRate: 4, length: 4, getChannelData: () => new Float32Array([0, 2, -2, 0]) };
    const bytes = await read(selectionWav(buffer, 0.25, 0.75));
    const view = new DataView(bytes);
    expect(text(bytes, 0, 4)).toBe('RIFF'); expect(text(bytes, 8, 4)).toBe('WAVE');
    expect(view.getUint32(40, true)).toBe(4);
    expect(view.getInt16(44, true)).toBe(32767); expect(view.getInt16(46, true)).toBe(-32768);
  });
  it('rejects reversed or out-of-bounds selections', () => {
    const buffer = { numberOfChannels: 1, sampleRate: 4, length: 4, getChannelData: () => new Float32Array(4) };
    expect(() => selectionWav(buffer, 1, 0)).toThrow(); expect(() => selectionWav(buffer, 0, 2)).toThrow();
  });
  it('exports stereo channels in interleaved order', async () => {
    const buffer = { numberOfChannels: 2, sampleRate: 4, length: 1, getChannelData: (channel: number) => new Float32Array([channel ? -0.5 : 0.5]) };
    const view = new DataView(await read(selectionWav(buffer, 0, 0.25)));
    expect(view.getUint16(22, true)).toBe(2); expect(view.getInt16(44, true)).toBe(16384); expect(view.getInt16(46, true)).toBe(-16384);
  });
  it('writes a MIDI track with tempo and matching note-on/off timing', async () => {
    const bytes = await read(notesMidi([note])); const data = new Uint8Array(bytes);
    expect(text(bytes, 0, 4)).toBe('MThd'); expect(text(bytes, 14, 4)).toBe('MTrk');
    expect(Array.from(data.slice(22, 29))).toEqual([0, 255, 81, 3, 7, 161, 32]);
    expect(Array.from(data.slice(29, 33))).toEqual([0, 144, 60, 102]);
    // 0.5 seconds = 480 ticks, encoded as a variable-length delta.
    expect(Array.from(data.slice(33, 38))).toEqual([131, 96, 128, 60, 0]);
    expect(new DataView(bytes).getUint32(18)).toBe(bytes.byteLength - 22);
  });
  it('bounds untrusted imported notes and excludes invalid timestamps and pitches', () => {
    const notes = previewNotes({ notes: [note, { ...note, pitch: 200 }, { ...note, start: 31 }, { ...note, duration: NaN }, { ...note, start: 29.9, duration: 5 }] });
    expect(notes).toHaveLength(2); expect(notes[1].duration).toBeCloseTo(0.1);
    expect(() => notesMidi([{ ...note, start: Infinity }])).toThrow();
    expect(() => previewNotes({ notes: new Array(20001) })).toThrow();
  });
});
