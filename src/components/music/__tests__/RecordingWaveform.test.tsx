import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RecordingWaveform from '../RecordingWaveform';

const fakes = vi.hoisted(() => ({ create: vi.fn(), regions: vi.fn() }));
vi.mock('wavesurfer.js', () => ({ default: { create: fakes.create } }));
vi.mock('wavesurfer.js/dist/plugins/regions.esm.js', () => ({ default: { create: fakes.regions } }));
beforeEach(() => vi.resetAllMocks());
afterEach(() => cleanup());

describe('Recording waveform', () => {
  it('plays the selected region and destroys the waveform on unmount', async () => {
    const listeners: Record<string, (value: { start: number; end: number; id: string }) => void> = {};
    const region = { start: 0, end: 10, id: 'region', setOptions: vi.fn() };
    const plugin = { on: vi.fn((event, callback) => { listeners[event] = callback; }), getRegions: () => [region], enableDragSelection: vi.fn(), addRegion: vi.fn(() => listeners['region-created'](region)) };
    fakes.regions.mockReturnValue(plugin);
    const wave = { on: vi.fn(), loadBlob: vi.fn().mockResolvedValue(undefined), getDuration: () => 20, play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), destroy: vi.fn() };
    fakes.create.mockReturnValue(wave);
    const onRegion = vi.fn(); const view = render(<RecordingWaveform file={new File(['audio'], 'song.wav')} onRegion={onRegion} />);
    await screen.findByRole('button', { name: 'Play selection' });
    fireEvent.change(screen.getByLabelText('Start (seconds)'), { target: { value: '2' } });
    expect(onRegion).toHaveBeenLastCalledWith({ start: 2, end: 10 });
    fireEvent.click(screen.getByRole('button', { name: 'Play selection' }));
    expect(wave.play).toHaveBeenCalledWith(2, 10);
    view.unmount(); expect(wave.destroy).toHaveBeenCalled();
  });
  it('ignores a decode that resolves after unmount', async () => {
    let resolve: () => void;
    const plugin = { on: vi.fn(), enableDragSelection: vi.fn(), addRegion: vi.fn() };
    const wave = { on: vi.fn(), loadBlob: vi.fn().mockReturnValue(new Promise<void>(done => { resolve = done; })), getDuration: vi.fn().mockReturnValue(20), destroy: vi.fn() };
    fakes.regions.mockReturnValue(plugin); fakes.create.mockReturnValue(wave);
    const onRegion = vi.fn(); const view = render(<RecordingWaveform file={new File(['audio'], 'song.wav')} onRegion={onRegion} />);
    await act(async () => {});
    view.unmount(); await act(async () => resolve());
    expect(wave.getDuration).not.toHaveBeenCalled(); expect(plugin.addRegion).not.toHaveBeenCalled();
  });
});
