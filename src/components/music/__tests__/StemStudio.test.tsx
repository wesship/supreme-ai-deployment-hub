import { act, fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StemStudio from '../StemStudio';
import { createStemJob, getStemJob, stemRequest } from '@/services/stemStudio';

vi.mock('@/services/config', () => ({ API_BASE_URL: 'http://localhost:8000' }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }) } } }));
vi.mock('@/services/stemStudio', () => ({ createStemJob: vi.fn(), getStemJob: vi.fn(), stemRequest: vi.fn() }));

const pending = { id: 'job-1', mode: 'vocals' as const, status: 'queued' as const, stems: [], error: null };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ enabled: true }) }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

async function submitRecording(fakeTimers = false) {
  await screen.findByText(/Private pilot/);
  fireEvent.change(screen.getByLabelText('Recording'), { target: { files: [new File(['audio'], 'song.wav', { type: 'audio/wav' })] } });
  fireEvent.click(screen.getByLabelText('I have permission to process this recording.'));
  if (fakeTimers) vi.useFakeTimers();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Separate recording' })); });
  expect(screen.getByText(/Separation: queued/)).toBeInTheDocument();
}

describe('Stem Studio', () => {
  it('keeps separation disabled when the worker is not configured', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ enabled: false }) } as Response);
    render(<StemStudio />);
    await screen.findByText('Stem Studio is awaiting worker configuration.');
    expect(screen.getByRole('button', { name: 'Separate recording' })).toBeDisabled();
    expect(createStemJob).not.toHaveBeenCalled();
  });

  it('requires a recording and permission before submitting', async () => {
    vi.mocked(createStemJob).mockResolvedValue(pending);
    render(<StemStudio />);
    await screen.findByText(/Private pilot/);
    fireEvent.change(screen.getByLabelText('Recording'), { target: { files: [new File(['audio'], 'song.wav')] } });
    expect(screen.getByRole('button', { name: 'Separate recording' })).toBeDisabled();
    fireEvent.click(screen.getByLabelText('I have permission to process this recording.'));
    fireEvent.click(screen.getByRole('button', { name: 'Separate recording' }));
    await screen.findByText(/Separation: queued/);
    expect(createStemJob).toHaveBeenCalledWith(expect.any(File), 'vocals');
  });

  it('continues polling after repeated transient failures and shows ready results', async () => {
    vi.mocked(createStemJob).mockResolvedValue(pending);
    vi.mocked(getStemJob).mockRejectedValueOnce(new Error('Worker unavailable')).mockRejectedValueOnce(new Error('Worker unavailable'))
      .mockResolvedValueOnce({ ...pending, status: 'completed', stems: ['vocals', 'no_vocals'] });
    render(<StemStudio />);
    await submitRecording(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(screen.getByRole('alert')).toHaveTextContent('Worker unavailable');
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(screen.getByRole('button', { name: 'Load 30-second stem previews' })).toBeEnabled();
    expect(getStemJob).toHaveBeenCalledTimes(3);
  });

  it('shows upload failure without fabricating a completed separation', async () => {
    vi.mocked(createStemJob).mockRejectedValue(new Error('Sign in to use Stem Studio.'));
    render(<StemStudio />);
    await screen.findByText(/Private pilot/);
    fireEvent.change(screen.getByLabelText('Recording'), { target: { files: [new File(['audio'], 'song.wav')] } });
    fireEvent.click(screen.getByLabelText('I have permission to process this recording.'));
    fireEvent.click(screen.getByRole('button', { name: 'Separate recording' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Sign in to use Stem Studio.'));
    expect(stemRequest).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Load 30-second stem previews' })).not.toBeInTheDocument();
  });
  it('loads short previews and schedules every stem on the same audio clock', async () => {
    const starts: ReturnType<typeof vi.fn>[] = [];
    class FakeAudioContext {
      currentTime = 10;
      destination = {};
      resume = vi.fn().mockResolvedValue(undefined);
      close = vi.fn().mockResolvedValue(undefined);
      decodeAudioData = vi.fn().mockResolvedValue({ duration: 30 });
      createGain = () => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() });
      createBufferSource = () => {
        const start = vi.fn(); starts.push(start);
        return { buffer: null, connect: vi.fn(), start, stop: vi.fn(), disconnect: vi.fn(), onended: null };
      };
    }
    vi.stubGlobal('AudioContext', FakeAudioContext);
    vi.mocked(createStemJob).mockResolvedValue(pending);
    vi.mocked(getStemJob).mockResolvedValue({ ...pending, status: 'completed', stems: ['vocals', 'no_vocals'] });
    vi.mocked(stemRequest).mockResolvedValue({ blob: async () => ({ arrayBuffer: async () => new ArrayBuffer(8) }) } as unknown as Response);
    render(<StemStudio />);
    await submitRecording(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Load 30-second stem previews' })); });
    expect(stemRequest).toHaveBeenCalledWith('/jobs/job-1/audio/vocals?preview=true', expect.any(Object));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Play stems' })); });
    expect(starts).toHaveLength(2);
    expect(starts[0]).toHaveBeenCalledWith(10.05, 0);
    expect(starts[1]).toHaveBeenCalledWith(10.05, 0);
    expect(screen.getByRole('button', { name: 'Download instrumental WAV' })).toBeEnabled();
  });

});
