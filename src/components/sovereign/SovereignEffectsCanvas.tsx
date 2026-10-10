import React, { useEffect, useRef } from 'react';
import '@/styles/sovereign-effects.css';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  phase: number;
};

const PARTICLE_COUNT_DESKTOP = 58;
const PARTICLE_COUNT_MOBILE = 28;
const CONNECTION_DISTANCE = 150;

const SovereignEffectsCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const storedPreference = window.localStorage.getItem('d3vonn-reduce-motion');
    let reducedMotion = storedPreference === 'true' || (storedPreference === null && reducedMotionQuery.matches);
    let frame = 0;
    let animationFrame = 0;
    let width = 0;
    let height = 0;
    let devicePixelRatio = 1;
    let pointerX = 0.5;
    let pointerY = 0.5;
    let particles: Particle[] = [];

    const seedParticles = () => {
      const count = width < 720 ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP;
      particles = Array.from({ length: count }, (_, index) => ({
        x: ((index * 83) % 997) / 997 * width,
        y: ((index * 137) % 991) / 991 * height,
        vx: (index % 2 === 0 ? 1 : -1) * (0.08 + (index % 7) * 0.015),
        vy: (index % 3 === 0 ? 1 : -1) * (0.05 + (index % 5) * 0.012),
        radius: 0.75 + (index % 4) * 0.35,
        phase: index * 0.41,
      }));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      devicePixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.floor(width * devicePixelRatio);
      canvas.height = Math.floor(height * devicePixelRatio);
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      seedParticles();
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);

      const driftX = reducedMotion ? 0 : (pointerX - 0.5) * 24;
      const driftY = reducedMotion ? 0 : (pointerY - 0.5) * 16;
      const pulse = reducedMotion ? 0.5 : 0.5 + Math.sin(frame * 0.012) * 0.5;

      const glow = context.createRadialGradient(
        width * (0.54 + (reducedMotion ? 0 : (pointerX - 0.5) * 0.04)),
        height * (0.42 + (reducedMotion ? 0 : (pointerY - 0.5) * 0.03)),
        0,
        width * 0.54,
        height * 0.42,
        Math.max(width, height) * 0.62,
      );
      glow.addColorStop(0, `rgba(67, 211, 255, ${0.08 + pulse * 0.035})`);
      glow.addColorStop(0.35, 'rgba(28, 151, 223, 0.035)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i += 1) {
        const particle = particles[i];

        if (!reducedMotion) {
          particle.x += particle.vx;
          particle.y += particle.vy;
          if (particle.x < -20) particle.x = width + 20;
          if (particle.x > width + 20) particle.x = -20;
          if (particle.y < -20) particle.y = height + 20;
          if (particle.y > height + 20) particle.y = -20;
        }

        for (let j = i + 1; j < particles.length; j += 1) {
          const other = particles[j];
          const dx = particle.x - other.x;
          const dy = particle.y - other.y;
          const distance = Math.hypot(dx, dy);
          if (distance > CONNECTION_DISTANCE) continue;

          const alpha = (1 - distance / CONNECTION_DISTANCE) * 0.16;
          context.beginPath();
          context.moveTo(particle.x + driftX, particle.y + driftY);
          context.lineTo(other.x + driftX, other.y + driftY);
          context.strokeStyle = `rgba(100, 224, 255, ${alpha})`;
          context.lineWidth = 0.6;
          context.stroke();
        }

        const localPulse = reducedMotion ? 0.72 : 0.62 + Math.sin(frame * 0.018 + particle.phase) * 0.38;
        context.beginPath();
        context.arc(particle.x + driftX, particle.y + driftY, particle.radius + localPulse * 0.55, 0, Math.PI * 2);
        context.fillStyle = `rgba(112, 233, 255, ${0.28 + localPulse * 0.34})`;
        context.shadowColor = 'rgba(65, 208, 255, 0.72)';
        context.shadowBlur = 10;
        context.fill();
        context.shadowBlur = 0;
      }

      const sweepY = reducedMotion ? height * 0.44 : ((frame * 0.55) % (height + 180)) - 90;
      const sweep = context.createLinearGradient(0, sweepY - 30, 0, sweepY + 30);
      sweep.addColorStop(0, 'rgba(83, 221, 255, 0)');
      sweep.addColorStop(0.5, 'rgba(83, 221, 255, 0.08)');
      sweep.addColorStop(1, 'rgba(83, 221, 255, 0)');
      context.fillStyle = sweep;
      context.fillRect(0, sweepY - 30, width, 60);

      if (!reducedMotion) {
        frame += 1;
        animationFrame = window.requestAnimationFrame(draw);
      } else {
        animationFrame = 0;
      }
    };

    const restartAnimation = () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      draw();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (reducedMotion) return;
      pointerX = event.clientX / Math.max(1, window.innerWidth);
      pointerY = event.clientY / Math.max(1, window.innerHeight);
    };

    const handleReducedMotion = (event: MediaQueryListEvent) => {
      const saved = window.localStorage.getItem('d3vonn-reduce-motion');
      reducedMotion = saved === 'true' || (saved === null && event.matches);
      restartAnimation();
    };

    const handleUserMotion = (event: Event) => {
      const detail = (event as CustomEvent<{ reduced?: boolean }>).detail;
      reducedMotion = Boolean(detail?.reduced);
      restartAnimation();
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('d3vonn-motion-change', handleUserMotion as EventListener);
    reducedMotionQuery.addEventListener('change', handleReducedMotion);
    draw();

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('d3vonn-motion-change', handleUserMotion as EventListener);
      reducedMotionQuery.removeEventListener('change', handleReducedMotion);
    };
  }, []);

  return (
    <div className="sovereign-effects" aria-hidden="true">
      <canvas ref={canvasRef} className="sovereign-effects__canvas" />
      <div className="sovereign-effects__halo sovereign-effects__halo--one" />
      <div className="sovereign-effects__halo sovereign-effects__halo--two" />
      <div className="sovereign-effects__scanline" />
    </div>
  );
};

export default SovereignEffectsCanvas;
