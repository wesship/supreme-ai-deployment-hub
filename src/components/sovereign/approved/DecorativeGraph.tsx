import { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supportsGraphWebGL } from './graphWebGL';

const ThreeBackground = lazy(() => import('./ThreeBackground'));

/** Probe before importing Three.js; keep the static network on unsupported hosts. */
export default function DecorativeGraph({ compact = false }: { compact?: boolean }) {
  const { pathname } = useLocation();
  const hiddenByFilm = /^\/film\/?$/.test(pathname);
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    if (!hiddenByFilm) setSupported(supportsGraphWebGL());
  }, [hiddenByFilm]);
  if (hiddenByFilm || !supported) return null;
  return <Suspense fallback={null}><ThreeBackground compact={compact} /></Suspense>;
}
