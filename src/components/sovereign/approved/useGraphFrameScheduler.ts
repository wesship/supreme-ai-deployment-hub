import { useEffect } from 'react';

export function useGraphFrameScheduler(invalidate: () => void, paused: boolean): void {
  useEffect(() => {
    if (paused) return;
    let frame = 0;
    let lastDraw = 0;
    const tick = (time: number) => {
      if (time - lastDraw >= 1000 / 30 - 1) {
        lastDraw = time;
        invalidate();
      }
      frame = requestAnimationFrame(tick);
    };
    const updateVisibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden) {
        lastDraw = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    document.addEventListener('visibilitychange', updateVisibility);
    updateVisibility();
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, [invalidate, paused]);
}
