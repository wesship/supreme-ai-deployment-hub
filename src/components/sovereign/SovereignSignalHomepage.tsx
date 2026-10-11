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

import DecorativeGraph from './approved/DecorativeGraph';

export default function SovereignSignalHomepage({ telemetry }: { telemetry: HomepageTelemetry }) {
  return (
    <div className="approved-home min-h-screen bg-background-50 text-foreground-900">
      <a className="approved-skip-link" href="#approved-main">Skip to main content</a>
      <div className="film-grain" aria-hidden="true" />
      <DecorativeGraph />
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
