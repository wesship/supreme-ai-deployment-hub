import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MusicWorkbench from '../MusicWorkbench';
import { createMusicToolJob, getStemJob, musicCapabilities, stemRequest } from '@/services/stemStudio';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }) } } }));
vi.mock('@/services/stemStudio', () => ({ createMusicToolJob: vi.fn(), getStemJob: vi.fn(), musicCapabilities: vi.fn(), stemRequest: vi.fn() }));
vi.mock('../RecordingWaveform', () => ({ default: () => <div>Local waveform available</div> }));
vi.mock('../BeatLab', () => ({ default: ({ importedNotes }: { importedNotes: unknown[] | null }) => <div>Melody notes: {importedNotes?.length ?? 0}</div> }));

beforeEach(() => { vi.resetAllMocks(); vi.mocked(musicCapabilities).mockResolvedValue({ enabled: true, tools: ['analyze', 'midi'] }); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function chooseFile() {
  await screen.findByText(/Worker tools require/);
  fireEvent.change(screen.getByLabelText('Workbench recording'), { target: { files: [new File(['audio'], 'song.wav')] } });
}

describe('Recording Tools', () => {
  it('keeps local waveform available while backend processing is disabled', async () => {
    vi.mocked(musicCapabilities).mockResolvedValue({ enabled: false, tools: [] });
    render(<MusicWorkbench />);
    await screen.findByText(/Worker processing is awaiting/);
    fireEvent.change(screen.getByLabelText('Workbench recording'), { target: { files: [new File(['audio'], 'song.wav')] } });
    expect(screen.getByText('Local waveform available')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run Analyze tempo & key' })).toBeDisabled();
  });
  it('requires permission and submits only the selected operation', async () => {
    vi.mocked(createMusicToolJob).mockResolvedValue({ id: 'job1', mode: 'analyze', status: 'queued', stems: [], error: null });
    render(<MusicWorkbench />); await chooseFile();
    expect(screen.getByRole('button', { name: 'Run Analyze tempo & key' })).toBeDisabled();
    fireEvent.click(screen.getByLabelText('I have permission to process this workbench recording.'));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Run Analyze tempo & key' })));
    expect(createMusicToolJob).toHaveBeenCalledWith(expect.any(File), 'analyze', {}, expect.any(AbortSignal));
    expect(screen.getByText(/Recording job: queued/)).toBeInTheDocument();
  });
  it('imports private note artifacts into the melody audition panel', async () => {
    vi.mocked(createMusicToolJob).mockResolvedValue({ id: 'job1', mode: 'midi', status: 'queued', stems: [], error: null });
    vi.mocked(getStemJob).mockResolvedValue({ id: 'job1', mode: 'midi', status: 'completed', stems: [], error: null, artifacts: [{ name: 'notes', filename: 'notes.json' }] });
    vi.mocked(stemRequest).mockResolvedValue({ json: async () => ({ notes: [{ pitch: 60, start: 0, duration: 0.5, velocity: 0.8 }] }) } as Response);
    render(<MusicWorkbench />); await chooseFile();
    fireEvent.click(screen.getByRole('button', { name: /Convert audio to MIDI/ }));
    fireEvent.click(screen.getByLabelText('I have permission to process this workbench recording.'));
    vi.useFakeTimers();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Run Convert audio to MIDI' })));
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Import into Melody Lab' })));
    expect(stemRequest).toHaveBeenCalledWith('/jobs/job1/artifacts/notes', expect.any(Object));
    expect(screen.getByText('Melody notes: 1')).toBeInTheDocument();
  });
});
