import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useHandTracking } from './useHandTracking';
import { createTracker } from './tracker';
vi.mock('./tracker', () => ({ createTracker: vi.fn() }));
const makeStream = () => { const track = { stop: vi.fn(), onended: null as (() => void) | null }; return { track, stream: { getTracks: () => [track] } as unknown as MediaStream }; };
function setup(getUserMedia = vi.fn()) {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  const hook = renderHook(() => useHandTracking(vi.fn()));
  const video = document.createElement('video'); video.play = vi.fn().mockResolvedValue(undefined); hook.result.current.videoRef.current = video;
  return { ...hook, getUserMedia };
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(createTracker).mockResolvedValue({ detectForVideo: () => ({ landmarks: [] }), close: vi.fn() }); });
it('requests no camera before explicit activation', () => { const { getUserMedia } = setup(); expect(getUserMedia).not.toHaveBeenCalled(); });
it('selects exact camera and never audio', async () => { const { stream } = makeStream(); const h = setup(vi.fn().mockResolvedValue(stream)); await act(() => h.result.current.start('usb', false)); expect(h.getUserMedia).toHaveBeenCalledWith({ audio: false, video: { width: 640, height: 480, deviceId: { exact: 'usb' } } }); h.unmount(); });
it('stops stream and model on unmount', async () => { const { stream, track } = makeStream(); const close = vi.fn(); vi.mocked(createTracker).mockResolvedValue({ detectForVideo: () => ({ landmarks: [] }), close }); const h = setup(vi.fn().mockResolvedValue(stream)); await act(() => h.result.current.start()); h.unmount(); expect(track.stop).toHaveBeenCalled(); expect(close).toHaveBeenCalled(); });
it('stops a stream that resolves after cancellation', async () => { const { stream, track } = makeStream(); let resolve!: (s: MediaStream) => void; const h = setup(vi.fn(() => new Promise<MediaStream>(r => { resolve = r; }))); let start!: Promise<void>; act(() => { start = h.result.current.start(); }); act(() => h.result.current.stop()); await act(async () => { resolve(stream); await start; }); expect(track.stop).toHaveBeenCalled(); expect(createTracker).not.toHaveBeenCalled(); });
it('can retry after permission denial', async () => { const { stream } = makeStream(); const h = setup(vi.fn().mockRejectedValueOnce(new Error('Permission denied')).mockResolvedValueOnce(stream)); await act(() => h.result.current.start()); expect(h.result.current.status).toBe('Permission denied'); await act(() => h.result.current.start()); expect(h.result.current.active).toBe(true); h.unmount(); });
it('releases resources on camera disconnect', async () => { const { stream, track } = makeStream(); const h = setup(vi.fn().mockResolvedValue(stream)); await act(() => h.result.current.start()); act(() => track.onended?.()); expect(h.result.current.active).toBe(false); expect(track.stop).toHaveBeenCalled(); expect(h.result.current.status).toMatch(/disconnected/); });
