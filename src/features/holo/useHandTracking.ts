import { useCallback, useEffect, useRef, useState } from 'react';
import { GestureEngine, type Hand } from './gestureEngine';
import { createTracker, type Tracker } from './tracker';
export function useHandTracking(onFrame: (hands: Hand[], command: 'reset' | 'arrange' | null) => void) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const callback = useRef(onFrame); callback.current = onFrame;
  const generation = useRef(0), stream = useRef<MediaStream | null>(null), model = useRef<Tracker | null>(null), raf = useRef(0);
  const [status, setStatus] = useState('Camera off'), [active, setActive] = useState(false), [loading, setLoading] = useState(false);
  const dispose = useCallback(() => {
    generation.current++; cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach(t => { t.onended = null; t.stop(); }); stream.current = null;
    model.current?.close(); model.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);
  const stop = useCallback(() => { dispose(); setActive(false); setLoading(false); setStatus('Camera off'); callback.current([], null); }, [dispose]);
  const start = useCallback(async (deviceId?: string, mirror = true) => {
    dispose(); const id = generation.current;
    setLoading(true); setStatus('Requesting camera…');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera requires HTTPS and a supported browser.');
      const s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: 640, height: 480, ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }) } });
      if (id !== generation.current) { s.getTracks().forEach(t => t.stop()); return; }
      stream.current = s;
      for (const track of s.getTracks()) track.onended = () => { if (id === generation.current) { stop(); setStatus('Camera disconnected. Select a camera and try again.'); } };
      const video = videoRef.current;
      if (!video) throw new Error('Camera view is unavailable.');
      video.srcObject = s; await video.play();
      if (id !== generation.current) return;
      setStatus('Loading local hand model…');
      const tracker = await createTracker();
      if (id !== generation.current) { tracker.close(); return; }
      model.current = tracker; setLoading(false); setActive(true); setStatus('Hand tracking active · frames stay on this device');
      const engine = new GestureEngine(); let last = 0, videoTime = -1;
      const tick = (now: number) => {
        if (id !== generation.current) return;
        try {
          if (now - last >= 33 && video.readyState >= 2 && video.currentTime !== videoTime) {
            last = now; videoTime = video.currentTime;
            const result = engine.update(tracker.detectForVideo(video, now).landmarks, now, mirror);
            callback.current(result.hands, result.command);
          }
          raf.current = requestAnimationFrame(tick);
        } catch (error) { stop(); setStatus(error instanceof Error ? error.message : 'Tracking stopped. Try again.'); }
      };
      raf.current = requestAnimationFrame(tick);
    } catch (error) {
      if (id !== generation.current) return;
      dispose(); setLoading(false); setActive(false);
      setStatus(error instanceof Error ? error.message : 'Camera permission denied or camera unavailable.');
    }
  }, [dispose, stop]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', hidden);
    return () => { document.removeEventListener('visibilitychange', hidden); dispose(); };
  }, [dispose, stop]);
  return { videoRef, active, loading, status, start, stop };
}
