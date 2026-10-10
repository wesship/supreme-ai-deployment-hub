import React, { useEffect, useRef } from 'react';
import '@/styles/sovereign-neural-web.css';

type Point3D = {
  x: number;
  y: number;
  z: number;
  phase: number;
};

type ProjectedPoint = Point3D & {
  sx: number;
  sy: number;
  depth: number;
};

const DESKTOP_POINTS = 900;
const MOBILE_POINTS = 520;
const DESKTOP_LINKS = 680;
const MOBILE_LINKS = 420;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function createSpherePoints(count: number): Point3D[] {
  return Array.from({ length: count }, (_, index) => {
    const y = 1 - (index / Math.max(1, count - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN_ANGLE * index;

    return {
      x: Math.cos(theta) * radius,
      y,
      z: Math.sin(theta) * radius,
      phase: index * 0.137,
    };
  });
}

function rotatePoint(point: Point3D, rotationX: number, rotationY: number): Point3D {
  const cosY = Math.cos(rotationY);
  const sinY = Math.sin(rotationY);
  const x1 = point.x * cosY - point.z * sinY;
  const z1 = point.x * sinY + point.z * cosY;

  const cosX = Math.cos(rotationX);
  const sinX = Math.sin(rotationX);
  const y2 = point.y * cosX - z1 * sinX;
  const z2 = point.y * sinX + z1 * cosX;

  return { ...point, x: x1, y: y2, z: z2 };
}

const SovereignNeuralWeb: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobileQuery = window.matchMedia('(max-width: 900px)');

    let frame = 0;
    let animationFrame = 0;
    let width = 1;
    let height = 1;
    let dpr = 1;
    let pointerX = 0.5;
    let pointerY = 0.5;
    let reducedMotion = reducedMotionQuery.matches || document.documentElement.classList.contains('sovereign-motion-reduced');
    let mobile = mobileQuery.matches;
    let points = createSpherePoints(mobile ? MOBILE_POINTS : DESKTOP_POINTS);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.35 : 1.75);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const t = reducedMotion ? 0 : frame * 0.0022;
      const rotationY = (pointerX - 0.5) * 0.72 + t;
      const rotationX = (pointerY - 0.5) * -0.34 + Math.sin(t * 0.7) * 0.055;
      const sphereRadius = Math.min(width, height) * (mobile ? 0.58 : 0.5);
      const centerX = width * (mobile ? 0.5 : 0.6);
      const centerY = height * (mobile ? 0.31 : 0.46);
      const cameraDistance = 3.4;

      const projected: ProjectedPoint[] = points.map((point) => {
        const rotated = rotatePoint(point, rotationX, rotationY);
        const perspective = cameraDistance / (cameraDistance - rotated.z);
        return {
          ...rotated,
          sx: centerX + rotated.x * sphereRadius * perspective,
          sy: centerY + rotated.y * sphereRadius * perspective,
          depth: (rotated.z + 1) / 2,
        };
      });

      const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, sphereRadius * 1.75);
      glow.addColorStop(0, 'rgba(78, 215, 255, 0.15)');
      glow.addColorStop(0.38, 'rgba(77, 168, 255, 0.065)');
      glow.addColorStop(0.7, 'rgba(255, 77, 166, 0.026)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      const linkBudget = mobile ? MOBILE_LINKS : DESKTOP_LINKS;
      let linksDrawn = 0;
      ctx.lineWidth = mobile ? 0.72 : 0.55;

      for (let i = 0; i < projected.length && linksDrawn < linkBudget; i += 1) {
        const a = projected[i];
        const neighborOffsets = [1, 2, 5, 13];

        for (const offset of neighborOffsets) {
          if (linksDrawn >= linkBudget) break;
          const b = projected[(i + offset) % projected.length];
          const dx = a.sx - b.sx;
          const dy = a.sy - b.sy;
          const distance = Math.hypot(dx, dy);
          const maxDistance = mobile ? 62 : 74;
          if (distance > maxDistance) continue;

          const depth = (a.depth + b.depth) * 0.5;
          const alpha = (1 - distance / maxDistance) * (mobile ? 0.34 : 0.22) * (0.7 + depth * 0.55);
          ctx.beginPath();
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b.sx, b.sy);
          ctx.strokeStyle = depth > 0.63
            ? `rgba(111, 240, 255, ${alpha})`
            : `rgba(77, 168, 255, ${alpha * 0.86})`;
          ctx.stroke();
          linksDrawn += 1;
        }
      }

      projected
        .slice()
        .sort((a, b) => a.depth - b.depth)
        .forEach((point, index) => {
          const shimmer = reducedMotion ? 0.75 : 0.68 + Math.sin(frame * 0.018 + point.phase) * 0.22;
          const radius = (0.55 + point.depth * (mobile ? 1.9 : 1.55)) * shimmer;
          const isAccent = index % 29 === 0 && point.depth > 0.58;

          ctx.beginPath();
          ctx.arc(point.sx, point.sy, radius, 0, Math.PI * 2);
          ctx.fillStyle = isAccent
            ? `rgba(255, 77, 166, ${0.38 + point.depth * 0.4})`
            : `rgba(111, 240, 255, ${0.22 + point.depth * 0.6})`;
          if (point.depth > 0.72) {
            ctx.shadowColor = isAccent ? 'rgba(255, 77, 166, 0.7)' : 'rgba(77, 200, 255, 0.82)';
            ctx.shadowBlur = 8 + point.depth * 10;
          }
          ctx.fill();
          ctx.shadowBlur = 0;
        });

      if (!reducedMotion) {
        frame += 1;
        animationFrame = window.requestAnimationFrame(render);
      } else {
        animationFrame = 0;
      }
    };

    const restart = () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      render();
    };

    const handlePointer = (event: PointerEvent) => {
      if (reducedMotion) return;
      pointerX = event.clientX / Math.max(1, window.innerWidth);
      pointerY = event.clientY / Math.max(1, window.innerHeight);
    };

    const handleReducedMotion = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches || document.documentElement.classList.contains('sovereign-motion-reduced');
      restart();
    };

    const handleMobile = (event: MediaQueryListEvent) => {
      mobile = event.matches;
      points = createSpherePoints(mobile ? MOBILE_POINTS : DESKTOP_POINTS);
      resize();
      restart();
    };

    const handleMotionPreference = () => {
      const next = reducedMotionQuery.matches || document.documentElement.classList.contains('sovereign-motion-reduced');
      if (next !== reducedMotion) {
        reducedMotion = next;
        restart();
      }
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', handlePointer, { passive: true });
    window.addEventListener('sovereign-motion-change', handleMotionPreference as EventListener);
    reducedMotionQuery.addEventListener('change', handleReducedMotion);
    mobileQuery.addEventListener('change', handleMobile);
    render();

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', handlePointer);
      window.removeEventListener('sovereign-motion-change', handleMotionPreference as EventListener);
      reducedMotionQuery.removeEventListener('change', handleReducedMotion);
      mobileQuery.removeEventListener('change', handleMobile);
    };
  }, []);

  return (
    <div className="sovereign-neural-web" aria-hidden="true">
      <canvas ref={canvasRef} className="sovereign-neural-web__canvas" />
      <div className="sovereign-neural-web__scan" />
      <div className="sovereign-neural-web__veil" />
    </div>
  );
};

export default SovereignNeuralWeb;
