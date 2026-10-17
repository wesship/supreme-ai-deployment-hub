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
  const [enableBackground, setEnableBackground] = useState(false);

  useEffect(() => {
    // Avoid loading WebGL/Three.js during the critical first-paint work.
    // Keep the branded 3D effect after the browser has reached idle.
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let idleId: number | undefined;
    if ('requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(() => setEnableBackground(true), { timeout: 3500 });
    } else {
      timeout = setTimeout(() => setEnableBackground(true), 1400);
    }
    return () => {
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timeout !== undefined) clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="approved-home min-h-screen bg-background-50 text-foreground-900">
      <a className="approved-skip-link" href="#approved-main">Skip to main content</a>
      <div className="film-grain" aria-hidden="true" />
      {enableBackground && <Suspense fallback={null}><ThreeBackground /></Suspense>}
      <div className="relative z-10">
        <Navbar />
        <div id="approved-main" tabIndex={-1}>
          <Hero />
          <SignalRail />
          <Platform />
          <Agents />
          <Films />
          <Infrastructure />
          <Voice />
          <Manifesto />
          <FinalCTA />
        </div>
        <Footer systemStatus={telemetry.systemStatus} />
      </div>
    </div>
  );
}
