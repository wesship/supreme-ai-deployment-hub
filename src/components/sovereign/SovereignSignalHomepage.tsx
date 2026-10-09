import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { HomepageTelemetry } from '@/lib/homepageTelemetry';
import SovereignNeuralWeb from './SovereignNeuralWeb';
import SovereignFeatureDeck from './SovereignFeatureDeck';
import '@/styles/sovereign-signal.css';
import '@/styles/readdy-mobile-parity.css';
import '@/styles/sovereign-handoff.css';

type Props = {
  telemetry: HomepageTelemetry;
};

const systems = [
  { label: 'HANDS', href: '/holo' },
  { label: 'HERMES', href: '/occ' },
  { label: 'AGENTS', href: '/ai-agents' },
  { label: 'FILMS', href: '/film' },
  { label: 'VOICE', href: '/voice-studio' },
  { label: 'MONEY', href: '/moneyhub' },
  { label: 'KNOWLEDGE', href: '/dkos-ingestion' },
];

const signalStates = ['VISION SURFACE', 'VOICE SURFACE', 'AGENT SURFACE', 'EDGE SURFACE'];

const ReaddyMobileHeroVisual: React.FC = () => (
  <div className="readdy-mobile-stage" aria-hidden="true">
    <div className="readdy-command-card">
      <img className="readdy-command-artwork" src="/d3vonn-enterprise-core.webp" alt="" />
      <span className="readdy-artwork-caption">CONCEPT VISUALIZATION</span>
    </div>

    <div className="readdy-globe-wrap">
      <div className="readdy-globe-orbit readdy-globe-orbit-a" />
      <div className="readdy-globe-orbit readdy-globe-orbit-b" />
      <div className="readdy-globe">
        <span className="readdy-globe-lat lat-a" />
        <span className="readdy-globe-lat lat-b" />
        <span className="readdy-globe-lat lat-c" />
        <span className="readdy-globe-lon lon-a" />
        <span className="readdy-globe-lon lon-b" />
        <span className="readdy-globe-lon lon-c" />
      </div>
    </div>
  </div>
);

const SovereignSignalHomepage: React.FC<Props> = ({ telemetry }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuNav = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    menuNav.current?.querySelector('a')?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  return (
    <main className="sovereign-page">
      <a className="sovereign-skip-link" href="#sovereign-main">Skip to main content</a>
      <SovereignNeuralWeb />
      <div className="sovereign-grid" aria-hidden="true" />
      <div className="sovereign-vignette" aria-hidden="true" />

      <header className={`sovereign-header${menuOpen ? ' sovereign-header-menu-open' : ''}`}>
        <Link to="/" className="sovereign-brand" aria-label="D3VONN.IO home">
          <span className="sovereign-mark"><img src="/d3vonn-logo.webp" alt="" /></span>
          <span>
            <strong>D3VONN.IO</strong>
            <small>SOVEREIGN SIGNAL</small>
          </span>
        </Link>

        <nav ref={menuNav} id="sovereign-primary-nav" className={`sovereign-nav${menuOpen ? ' sovereign-nav-open' : ''}`} aria-label="Primary navigation" onClick={() => setMenuOpen(false)}>
          <Link reloadDocument to="/holo">HANDS</Link>
          <Link to="/platform">PLATFORM</Link>
          <Link to="/marketplace">MARKETPLACE</Link>
          <Link to="/pricing">PRICING</Link>
          <Link to="/institute">INSTITUTE</Link>
          <Link to="/status">STATUS</Link>
          <Link to="/app" className="sovereign-nav-cta">ENTER SYSTEM</Link>
        </nav>
        <button ref={menuButton} className="sovereign-mobile-menu" type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="sovereign-primary-nav" onClick={() => setMenuOpen((open) => !open)}>
          <span /><span /><span />
        </button>
      </header>

      <section id="sovereign-main" className="sovereign-hero" aria-labelledby="sovereign-title">
        <div className="sovereign-kicker">
          <span className="sovereign-kicker-line" />
          <span>D3VONN NETWORK // SYSTEMS ACTIVE</span>
          <span className="sovereign-kicker-line" />
        </div>

        <ReaddyMobileHeroVisual />
        <div className="readdy-mobile-title" aria-hidden="true">INTELLIGENCE<br />UNDER YOUR<br />COMMAND.</div>

        <div className="sovereign-console-wrap">
          <div className="sovereign-orbit sovereign-orbit-one" aria-hidden="true" />
          <div className="sovereign-orbit sovereign-orbit-two" aria-hidden="true" />

          <div className="sovereign-console">
            <div className="console-topbar">
              <span>D3VONN // COMMAND NODE</span>
              <span>CORE // v4.2</span>
            </div>

            <div className="console-body">
              <div className="console-copy">
                <p className="eyebrow">SOVEREIGN AI OPERATING SYSTEM</p>
                <h1 id="sovereign-title">INTELLIGENCE<br />UNDER YOUR COMMAND.</h1>
                <p className="hero-copy">
                  Build, deploy, and direct sovereign AI systems from one expanding creative and operational ecosystem.
                </p>

                <div className="hero-actions">
                  <Link to="/app" className="signal-button signal-button-primary">ENTER COMMAND</Link>
                  <Link to="/occ" className="signal-button">OPEN HERMES</Link>
                  <Link to="/voice-studio" className="signal-button">TALK TO D3VONN</Link>
                </div>
              </div>

              <div className="console-visual" aria-label="D3VONN system status visualization">
                <div className="core-ring core-ring-a" />
                <div className="core-ring core-ring-b" />
                <div className="core-ring core-ring-c" />
                <div className="core-node">
                  <span className="core-logo">D3</span>
                  <small>LINKED</small>
                </div>
                <div className="signal-beam signal-beam-a" />
                <div className="signal-beam signal-beam-b" />
                <div className="signal-beam signal-beam-c" />
              </div>
            </div>

            <div className="console-footer">
              <span>Sovereign Signal // Link Established</span>
              <span>6 Surfaces / 1 Command / ∞ Signals</span>
            </div>
          </div>
        </div>

        <div className="readdy-mobile-copy">
          <p>Build, deploy, and direct sovereign AI systems from one expanding creative and operational ecosystem.</p>
          <div className="hero-actions">
            <Link to="/app" className="signal-button signal-button-primary">ENTER COMMAND</Link>
            <Link to="/occ" className="signal-button">OPEN HERMES</Link>
            <Link to="/voice-studio" className="signal-button">TALK TO D3VONN</Link>
          </div>
        </div>

        <div className="signal-strip" aria-label="System readiness">
          {[`CORE — ${telemetry.systemStatus}`, ...signalStates].map((state) => (
            <span key={state}><i />{state}</span>
          ))}
        </div>

        <div className="sovereign-telemetry" aria-label="Live platform telemetry" aria-live="polite">
          <div><small>ACTIVE AGENTS</small><strong>{telemetry.activeAgents}</strong></div>
          <div><small>WORKFLOWS COMPLETED</small><strong>{telemetry.workflowsCompleted}</strong></div>
          <div><small>TASKS PROCESSED</small><strong>{telemetry.tasksProcessed}</strong></div>
          <div><small>SYSTEM STATUS</small><strong>{telemetry.systemStatus}</strong></div>
          <div><small>HERMES QUEUE</small><strong>{telemetry.hermesQueue}</strong></div>
        </div>
      </section>

      <SovereignFeatureDeck telemetry={telemetry} />

      <section id="platform" className="sovereign-systems" aria-label="D3VONN systems">
        <div className="systems-heading">
          <span>ONE SIGNAL.</span>
          <span>MULTIPLE SYSTEMS.</span>
        </div>
        <div className="system-links">
          {systems.map((system) => (
            <Link reloadDocument={system.href === "/holo"} key={system.label} to={system.href} className="system-link">
              <span>{system.label}</span>
              <span>↗</span>
            </Link>
          ))}
        </div>
      </section>

      <footer className="sovereign-footer">
        <span>THE SIGNAL IS YOURS.</span>
        <span>Signal over noise. Command over chaos.</span>
      </footer>
    </main>
  );
};

export default SovereignSignalHomepage;
