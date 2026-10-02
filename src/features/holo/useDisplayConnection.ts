import { useCallback, useEffect, useRef, useState } from 'react';
export function useDisplayConnection() {
  const rootRef = useRef<HTMLDivElement | null>(null), mounted = useRef(true);
  const [fullscreen, setFullscreen] = useState(false), [error, setError] = useState('');
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => {
    mounted.current = true;
    const update = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', update);
    return () => { mounted.current = false; document.removeEventListener('fullscreenchange', update); };
  }, []);
  const toggleFullscreen = useCallback(async () => {
    try {
      setError('');
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (rootRef.current?.requestFullscreen) await rootRef.current.requestFullscreen();
      else throw new Error('Fullscreen unavailable. Maximize this browser window on your display.');
    } catch { if (mounted.current) setError('Fullscreen unavailable. Maximize this browser window on your display.'); }
  }, []);
  const findCameras = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      if (mounted.current) { setCameras(list.filter(d => d.kind === 'videoinput')); setError(''); }
    } catch { if (mounted.current) setError('Camera discovery unavailable. Try the default camera over HTTPS.'); }
  }, []);
  return { rootRef, fullscreen, error, cameras, findCameras, toggleFullscreen };
}
