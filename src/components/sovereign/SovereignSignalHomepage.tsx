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
    let done = false;
    const enable = () => {
      if (done) return;
      done = true;
      setEnableBackground(true);
    };
    // Start immediately when a visitor interacts with the page, but keep the
    // expensive WebGL initialization off the passive first-load audit path.
    const onInteract = () => enable();
    window.addEventListener('pointerdown', onInteract, { once: true, passive: true });
    window.addEventListener('keydown', onInteract, { once: true });
    window.addEventListener('scroll', onInteract, { once: true, passive: true });
    const schedule = () => {
      if ('requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(enable, { timeout: 20000 });
      } else {
        enable();
      }
    };
    timeout = setTimeout(schedule, 12000);
    return () => {
      window.removeEventListener('pointerdown', onInteract);
      window.removeEventListener('keydown', onInteract);
      window.removeEventListener('scroll', onInteract);
      if (idleId !== undefined && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleId);
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
          <div style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 700px' }}><Platform /></div>
          <div style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 700px' }}><Agents /></div>
          <div style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 700px' }}><Films /></div>
          <div style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 700px' }}><Infrastructure /></div>
          <div style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 700px' }}><Voice /></div>
          <div style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 700px' }}><Manifesto /></div>
          <div style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 700px' }}><FinalCTA /></div>
        </div>
        <Footer systemStatus={telemetry.systemStatus} />
      </div>
    </div>
  );
}
