import React, { useEffect, useRef } from 'react';
import { useCalmMotion } from './os-hooks';

/**
 * Dimensional data corridor — a perspective tunnel of light traces drawn on a
 * 2D canvas (cheap, no WebGL, never blocks first paint since it is lazy-loaded).
 * Warm metallic + lime + orange only.
 */
const TRACE_COLORS = ['rgba(183,224,23,0.9)', 'rgba(255,122,26,0.85)', 'rgba(150,146,136,0.65)'];

type Trace = { angle: number; depth: number; speed: number; color: string; length: number };

const DataCorridor: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const calm = useCalmMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let frame = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const count = calm ? 26 : 70;
    const traces: Trace[] = Array.from({ length: count }, () => ({
      angle: Math.random() * Math.PI * 2,
      depth: Math.random(),
      speed: 0.0016 + Math.random() * 0.0042,
      color: TRACE_COLORS[Math.floor(Math.random() * TRACE_COLORS.length)],
      length: 0.05 + Math.random() * 0.14,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      const cx = width * 0.5;
      const cy = height * 0.48;
      const radius = Math.max(width, height) * 0.78;

      // Chrome horizon rings
      ctx.lineWidth = 1;
      for (let i = 1; i <= 7; i += 1) {
        const r = (i / 7) ** 2.2 * radius;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(14,14,12,${0.05 + i * 0.008})`;
        ctx.ellipse(cx, cy, r, r * 0.58, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      traces.forEach((trace) => {
        trace.depth += trace.speed;
        if (trace.depth > 1) {
          trace.depth = 0;
          trace.angle = Math.random() * Math.PI * 2;
        }

        const project = (d: number) => {
          const scale = d ** 2.2;
          return [cx + Math.cos(trace.angle) * radius * scale, cy + Math.sin(trace.angle) * radius * scale * 0.58];
        };

        const [x1, y1] = project(Math.max(trace.depth - trace.length, 0));
        const [x2, y2] = project(trace.depth);

        ctx.beginPath();
        ctx.strokeStyle = trace.color;
        ctx.globalAlpha = Math.min(trace.depth * 1.5, 1) * 0.55;
        ctx.lineWidth = 0.6 + trace.depth * 2.4;
        ctx.lineCap = 'round';
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      });

      frame = window.requestAnimationFrame(render);
    };

    if (calm) {
      render();
      window.cancelAnimationFrame(frame);
    } else {
      frame = window.requestAnimationFrame(render);
    }

    const onVisibility = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(frame);
      } else if (!calm) {
        frame = window.requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
      observer.disconnect();
    };
  }, [calm]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
};

export default DataCorridor;
