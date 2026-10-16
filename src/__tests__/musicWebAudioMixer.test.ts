import { describe, expect, it } from 'vitest';
import { encodeWav, stemGain, measurePeak, safeMixScale, waveformBars } from '../music/MusicWebAudioMixer';

describe('Music Web Audio mixer', () => {
  it('honors mute and solo before mixing', () => {
    expect(stemGain({ muted: false, solo: false, gain: .75 }, false)).toBe(.75);
    expect(stemGain({ muted: false, solo: false, gain: .75 }, true)).toBe(0);
    expect(stemGain({ muted: false, solo: true, gain: .75 }, true)).toBe(.75);
    expect(stemGain({ muted: true, solo: true, gain: .75 }, true)).toBe(0);
  });
  it('encodes a stereo 16-bit PCM WAV with correct header and length', async () => {
    const blob = encodeWav([new Float32Array([0, 1, -1]), new Float32Array([0, -.5, .5])], 44100);
    const bytes = new DataView(await blob.arrayBuffer());
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
