import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MusicWebAudioMixer from '@/music/MusicWebAudioMixer';
import { validateMixerInputs, type MixerSession } from '@/music/musicMixer';

function audioBuffer(duration = .1): AudioBuffer {
  return { duration, length: Math.ceil(duration * 44100), sampleRate: 44100, numberOfChannels: 2, getChannelData: () => new Float32Array(Math.ceil(duration * 44100)).fill(.2) } as unknown as AudioBuffer;
}
function session(): MixerSession {
  return { id: 'job1', label: '30-second previews', stems: [{ id: 'v', name: 'Vocals preview', buffer: audioBuffer() }, { id: 'i', name: 'Instrumental preview', buffer: audioBuffer() }] };
}
const sources: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
const gains: { gain: { value: number; setTargetAtTime: ReturnType<typeof vi.fn> }; disconnect: ReturnType<typeof vi.fn> }[] = [];
let resume: () => Promise<void>;
let renderAudio: () => Promise<AudioBuffer>;
const contexts: FakeContext[] = [];
class FakeContext {
  currentTime = 10;
  sampleRate = 44100;
  destination = {};
  resume = () => resume();
  close = vi.fn().mockResolvedValue(undefined);
  decodeAudioData = vi.fn().mockResolvedValue(audioBuffer());
  constructor() { contexts.push(this); }
  createBufferSource() {
    const source = { buffer: null, connect: (node: unknown) => node, start: vi.fn(), stop: vi.fn(), disconnect: vi.fn() };
    sources.push(source); return source;
  }
  createGain() {
    const node = { gain: { value: 1, setTargetAtTime: vi.fn() }, connect: (destination: unknown) => destination, disconnect: vi.fn() };
    gains.push(node); return node;
  }
  startRendering = () => renderAudio();
}
beforeEach(() => {
  sources.length = 0; gains.length = 0; contexts.length = 0;
  resume = () => Promise.resolve(); renderAudio = () => Promise.resolve(audioBuffer());
  vi.stubGlobal('AudioContext', FakeContext); vi.stubGlobal('OfflineAudioContext', FakeContext);
  vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(1)); vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('URL', { createObjectURL: vi.fn().mockReturnValue('blob:test'), revokeObjectURL: vi.fn() });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Shared-clock mixer integration', () => {
  it('starts both preview buffers on one clock and never resumes at a negative offset', async () => {
    render(<MusicWebAudioMixer session={session()} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Play mix' })));
    expect(sources[0].start).toHaveBeenCalledWith(10.04, 0); expect(sources[1].start).toHaveBeenCalledWith(10.04, 0);
    contexts[contexts.length - 1].currentTime = 10.01;
    fireEvent.click(screen.getByRole('button', { name: 'Pause mix' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Play mix' })));
    expect(sources[2].start.mock.calls[0][0]).toBeCloseTo(10.05); expect(sources[2].start.mock.calls[0][1]).toBe(0);
  });
  it('does not start audio after a pending resume is cancelled', async () => {
    let resolve: () => void;
    resume = () => new Promise<void>(done => { resolve = done; });
    render(<MusicWebAudioMixer session={session()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play mix' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear mixer' }));
    await act(async () => resolve());
    expect(sources).toHaveLength(0);
  });
  it('updates mute and solo gains while playing and disconnects on unmount', async () => {
    const view = render(<MusicWebAudioMixer session={session()} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Play mix' })));
    fireEvent.click(screen.getByLabelText('Solo Vocals preview'));
    expect(gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(1, 10, .008);
    expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 10, .008);
    view.unmount(); expect(sources[0].stop).toHaveBeenCalled(); expect(gains[0].disconnect).toHaveBeenCalled(); expect(contexts[contexts.length - 1].close).toHaveBeenCalled();
  });
  it('suppresses a stale offline export after the mixer is cleared', async () => {
    let resolve: (value: AudioBuffer) => void;
    renderAudio = () => new Promise<AudioBuffer>(done => { resolve = done; });
    render(<MusicWebAudioMixer session={session()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export WAV' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear mixer' }));
    await act(async () => resolve(audioBuffer()));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(screen.queryByText(/Last export:/)).not.toBeInTheDocument();
  });
  it('replaces imported buffers when a new private session arrives', async () => {
    const view = render(<MusicWebAudioMixer session={session()} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Play mix' })));
    view.rerender(<MusicWebAudioMixer session={{ id: 'job2', label: 'New previews', stems: [{ id: 'new', name: 'New voice', buffer: audioBuffer() }] }} />);
    expect(sources[0].stop).toHaveBeenCalled(); expect(screen.queryByText('Vocals preview')).not.toBeInTheDocument(); expect(screen.getByText('New voice')).toBeInTheDocument();
  });
  it('rejects compressed audio with oversized duration before decoding it', async () => {
    class Media {
      duration = 601;
      onloadedmetadata: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) { queueMicrotask(() => this.onloadedmetadata?.()); }
      removeAttribute() {} load() {}
    }
    vi.stubGlobal('Audio', Media);
    render(<MusicWebAudioMixer />);
    await act(async () => fireEvent.change(screen.getByLabelText('Add stems to Web Audio mixer'), { target: { files: [new File(['audio'], 'long.mp3', { type: 'audio/mpeg' })] } }));
    expect(contexts[contexts.length - 1].decodeAudioData).not.toHaveBeenCalled(); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
    expect(screen.getByRole('alert')).toHaveTextContent('10-minute limit');
  });
  it('rejects too many tracks, duplicate IDs, and decoded memory overflow', () => {
    const stem = session().stems[0];
    expect(() => validateMixerInputs(Array.from({ length: 9 }, (_, i) => ({ ...stem, id: String(i) })))).toThrow();
    expect(() => validateMixerInputs([stem, stem])).toThrow();
    expect(() => validateMixerInputs([{ ...stem, buffer: { ...audioBuffer(), length: 128 * 1024 * 1024 } as AudioBuffer }])).toThrow();
  });
});
