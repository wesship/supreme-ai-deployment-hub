import { useEffect, useRef, useState } from 'react';

/** True when the user prefers reduced motion, or the device looks low-powered. */
export function useCalmMotion(): boolean {
  const [calm, setCalm] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const lowPower =
      (typeof navigator !== 'undefined' && (navigator.hardwareConcurrency ?? 8) <= 4) ||
      !window.matchMedia('(pointer: fine)').matches;

    const update = () => setCalm(query.matches || lowPower);
    update();

    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return calm;
}

/** True on fine-pointer (desktop) devices — used to gate pointer-reactive effects. */
export function useFinePointer(): boolean {
  const [fine, setFine] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(pointer: fine)');
    const update = () => setFine(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return fine;
}

/** Subtle magnetic pull toward the pointer. Disabled for touch / reduced motion. */
export function useMagnetic<T extends HTMLElement>(strength = 8) {
  const ref = useRef<T | null>(null);
  const enabled = useFinePointer() && !useCalmMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;

    const onMove = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      const x = (event.clientX - (rect.left + rect.width / 2)) / rect.width;
      const y = (event.clientY - (rect.top + rect.height / 2)) / rect.height;
      node.style.transform = `translate3d(${x * strength}px, ${y * strength}px, 0)`;
    };
    const onLeave = () => {
      node.style.transform = 'translate3d(0,0,0)';
    };

    node.addEventListener('pointermove', onMove);
    node.addEventListener('pointerleave', onLeave);
    return () => {
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerleave', onLeave);
      node.style.transform = '';
    };
  }, [enabled, strength]);

  return ref;
}

/** Reveals children once the element scrolls into view (no generic fade-only motion). */
export function useInView<T extends HTMLElement>(amount = 0.25) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        });
      },
      { threshold: amount },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [amount]);

  return { ref, inView };
}
