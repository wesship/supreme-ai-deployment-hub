import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BeatLab from '../BeatLab';
import { auditionNotes, startBeat } from '@/services/musicInstruments';

vi.mock('@/services/musicInstruments', () => ({ auditionNotes: vi.fn(), startBeat: vi.fn() }));
const note = { pitch: 60, start: 0, duration: 0.5, velocity: 0.8 };
beforeEach(() => vi.resetAllMocks());
afterEach(() => cleanup());

describe('Beat & Melody Lab', () => {
  it('edits a sequencer step and passes the changed pattern to the audio engine', async () => {
    const stop = vi.fn(); vi.mocked(startBeat).mockResolvedValue({ stop });
    render(<BeatLab importedNotes={null} />);
    const step = screen.getByRole('button', { name: 'Kick step 2' });
    expect(step).toHaveAttribute('aria-pressed', 'false'); fireEvent.click(step);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Play beat' })));
    expect(vi.mocked(startBeat).mock.calls[0][0]()[0][1]).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Stop beat' })); expect(stop).toHaveBeenCalled();
  });
  it('auditions edited imported notes and disposes audio when unmounted', async () => {
    const stop = vi.fn(); vi.mocked(auditionNotes).mockResolvedValue({ stop });
    const view = render(<BeatLab importedNotes={[note]} />);
    fireEvent.change(screen.getByLabelText('Note 1 pitch'), { target: { value: '64' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Play melody' })));
    expect(auditionNotes).toHaveBeenCalledWith([{ ...note, pitch: 64 }], 'triangle');
    view.unmount(); expect(stop).toHaveBeenCalled();
  });
  it('stops an engine that resolves after cancellation', async () => {
    let resolve: (engine: { stop: () => void }) => void;
    vi.mocked(startBeat).mockReturnValue(new Promise(done => { resolve = done; }));
    render(<BeatLab importedNotes={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play beat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stop all instruments' }));
    const stop = vi.fn(); await act(async () => resolve({ stop }));
    expect(stop).toHaveBeenCalled();
  });
});
