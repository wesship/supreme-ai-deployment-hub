import { describe, expect, it } from 'vitest';
import { encodeWav, stemGain, measurePeak, safeMixScale, waveformBars } from '../music/MusicWebAudioMixer';

const blobBytes = (blob: Blob): Promise<DataView> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(new DataView(reader.result as ArrayBuffer));
  reader.onerror = () => reject(reader.error);
  reader.readAsArrayBuffer(blob);
});

describe('Music Web Audio mixer', () => {
  it('honors mute and solo before mixing', () => {
    expect(stemGain({ muted: false, solo: false, gain: .75 }, false)).toBe(.75);
    expect(stemGain({ muted: false, solo: false, gain: .75 }, true)).toBe(0);
    expect(stemGain({ muted: false, solo: true, gain: .75 }, true)).toBe(.75);
    expect(stemGain({ muted: true, solo: true, gain: .75 }, true)).toBe(0);
  });
  it('encodes a stereo 16-bit PCM WAV with correct header and length', async () => {
    const blob = encodeWav([new Float32Array([0, 1, -1]), new Float32Array([0, -.5, .5])], 44100);
    const bytes = await blobBytes(blob);
    expect(blob.size).toBe(56);
    expect(bytes.getUint32(24, true)).toBe(44100);
    expect(bytes.getUint16(22, true)).toBe(2);
    expect(bytes.getUint16(34, true)).toBe(16);
    expect(bytes.getUint32(40, true)).toBe(12);
    expect(bytes.getInt16(46, true)).toBe(0);
    expect(bytes.getInt16(48, true)).toBe(32767);
    expect(bytes.getInt16(50, true)).toBe(-16384);
  });
});

describe('Gate 6 export protection and waveform', () => {
  it('measures peak and calculates a safe reduction without boosting quiet audio', () => {
    expect(measurePeak([new Float32Array([-.5, 1.25]), new Float32Array([.2])])).toBeCloseTo(1.25);
    expect(safeMixScale(1.25)).toBeCloseTo(.784);
    expect(safeMixScale(.4)).toBe(1);
    expect(safeMixScale(0)).toBe(1);
  });
  it('extracts a representative bounded peak display', () => {
    const buffer = { getChannelData: () => new Float32Array([0, .5, -1, .25]) } as unknown as AudioBuffer;
    expect(waveformBars(buffer, 4)).toEqual([0, .5, 1, .25]);
  });
});

describe('Gate 7 deterministic signal checks', () => {
  it('writes mono PCM WAV with accurate sample-rate and sample order', async () => {
    const wav = encodeWav([new Float32Array([0, 0.5, -0.5, 1, -1])], 48000);
    const data = await blobBytes(wav);
    expect(wav.size).toBe(54);
    expect(data.getUint16(22, true)).toBe(1);
    expect(data.getUint32(24, true)).toBe(48000);
    expect(data.getUint32(40, true)).toBe(10);
    expect([44, 46, 48, 50, 52].map(x => data.getInt16(x, true))).toEqual([0, 16383, -16384, 32767, -32768]);
  });

  it('preserves stereo channel separation and interleaving', async () => {
    const wav = encodeWav([new Float32Array([1, 0]), new Float32Array([0, -1])], 44100);
    const data = await blobBytes(wav);
    expect([44, 46, 48, 50].map(x => data.getInt16(x, true))).toEqual([32767, 0, 0, -32768]);
  });

  it('keeps scaled positive and negative samples within the 0.98 peak ceiling', () => {
    const input = [new Float32Array([1.5, -.25]), new Float32Array([-.75, -2])];
    const scale = safeMixScale(measurePeak(input));
    expect(scale).toBeCloseTo(.49);
    const output = input.map(channel => Float32Array.from(channel, sample => sample * scale));
    expect(measurePeak(output)).toBeCloseTo(.98, 5);
  });

  it('does not boost quiet or silent stems', () => {
    expect(safeMixScale(measurePeak([new Float32Array([0, 0])]))).toBe(1);
    expect(safeMixScale(measurePeak([new Float32Array([.02, -.15])]))).toBe(1);
  });
});
