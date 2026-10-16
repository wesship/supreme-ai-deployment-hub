import { lazy, Suspense, useEffect, useState } from 'react';
import type { HomepageTelemetry } from '@/lib/homepageTelemetry';
import Navbar from './approved/Navbar';
import Hero from './approved/Hero';
import SignalRail from './approved/SignalRail';
import Platform from './approved/Platform';
import Agents from './approved/Agents';
import Films from './approved/Films';
import Infrastructure from './approved/Infrastructure';
import Voice from './approved/Voice';
import Manifesto from './approved/Manifesto';
import FinalCTA from './approved/FinalCTA';
import Footer from './approved/Footer';
import '@/styles/approved-home.css';
import '@/styles/approved-icons.css';

const ThreeBackground = lazy(() => import('./approved/ThreeBackground'));

export default function SovereignSignalHomepage({ telemetry }: { telemetry: HomepageTelemetry }) {
  const [showBackground, setShowBackground] = useState(false);

  useEffect(() => {
    // Keep WebGL/Three.js initialization out of the critical first-paint window.
    // The approved visual effect still loads after the page becomes interactive.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let idleId: number | undefined;
    const schedule = () => {
      if ('requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(() => setShowBackground(true), { timeout: 6000 });
      } else {
        timer = setTimeout(() => setShowBackground(true), 3500);
      }
    };
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });
    return () => {
      window.removeEventListener('load', schedule);
      if (timer !== undefined) clearTimeout(timer);
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
    };
  }, []);

  return (
    <div className="approved-home min-h-screen bg-background-50 text-foreground-900">
      <a className="approved-skip-link" href="#approved-main">Skip to main content</a>
      <div className="film-grain" aria-hidden="true" />
      {showBackground && <Suspense fallback={null}><ThreeBackground /></Suspense>}
      <div className="relative z-10">
        <Navbar />
        <div id="approved-main" tabIndex={-1}>
          <Hero />
          {/* Per-section containment lets the browser skip offscreen paint independently.
              A single wrapper around all sections would defeat the optimization. */}
          <div style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 800px' }}>
            <SignalRail />
          </div>
          <div style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 800px' }}>
            <Platform />
          </div>
          <div style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 800px' }}>
            <Agents />
          </div>
          <div style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 800px' }}>
            <Films />
          </div>
          <div style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 800px' }}>
            <Infrastructure />
          </div>
          <div style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 800px' }}>
            <Voice />
          </div>
          <div style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 800px' }}>
            <Manifesto />
          </div>
          <div style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 800px' }}>
            <FinalCTA />
          </div>
        </div>
        <Footer systemStatus={telemetry.systemStatus} />
      </div>
    </div>
  );
}
