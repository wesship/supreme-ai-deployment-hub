import React from 'react';
import { Link } from 'react-router-dom';
import type { HomepageTelemetry } from '@/lib/homepageTelemetry';
import SovereignNeuralWeb from './SovereignNeuralWeb';
import SovereignFeatureDeck from './SovereignFeatureDeck';
import '@/styles/sovereign-signal.css';
import '@/styles/readdy-mobile-parity.css';

type Props = {
  telemetry: HomepageTelemetry;
};

const systems = [
  { label: 'HERMES', href: '/occ' },
  { label: 'AGENTS', href: '/ai-agents' },
  { label: 'FILMS', href: '/film' },
  { label: 'VOICE', href: '/voice-studio' },
  { label: 'MONEY', href: '/moneyhub' },
  { label: 'KNOWLEDGE', href: '/dkos-ingestion' },
];

const signalStates = ['CORE ONLINE', 'VISION — READY', 'VOICE — READY', 'AGENTS — READY', 'EDGE — READY'];

const ReaddyMobileHeroVisual: React.FC = () => (
  <div className="readdy-mobile-stage" aria-hidden="true">
    <div className="readdy-command-card">
      <div className="readdy-card-column readdy-card-column-left">
        <div className="readdy-mini-panel readdy-mini-panel-tall">
          <small>ORCHESTRATION FORCE</small>
          <strong>12,843</strong>
          <span className="readdy-spark-bars"><i /><i /><i /><i /><i /><i /></span>
          <em>OPTIMAL</em>
        </div>
        <div className="readdy-mini-panel"><small>DOMAIN INTELLIGENCE</small><span className="readdy-stars">✦ · ✧ · ✦</span></div>
        <div className="readdy-mini-panel"><small>KNOWLEDGE GRAPH</small><span className="readdy-stars">· ✦ · ✧ ·</span></div>
      </div>

      <div className="readdy-card-center">
        <div className="readdy-card-grid" />
        <div className="readdy-helmet-shell">
          <img src="/d3vonn-icon.svg" alt="" />
        </div>
        <div className="readdy-card-wordmark">D3VONN.IO</div>
        <div className="readdy-card-message">You're here at an opportune time so Live</div>
        <div className="readdy-horizon-glow" />
        <div className="readdy-cloud readdy-cloud-a" />
        <div className="readdy-cloud readdy-cloud-b" />
      </div>

      <div className="readdy-card-column readdy-card-column-right">
        <div className="readdy-mini-panel readdy-mini-panel-tall"><small>AI MARKETPLACE</small><strong>2,465+</strong><span>AGENTS & TOOLS</span></div>
        <div className="readdy-mini-panel"><small>AUTOMATION WORKFLOWS</small><span className="readdy-flow-dots">◈—◈—◈</span></div>
        <div className="readdy-mini-panel"><small>AI VOICE STUDIO</small><span className="readdy-wave">▁▃▅▂▆▃▇▂</span></div>
      </div>
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
  return (
    <main className="sovereign-page">
      <a className="sovereign-skip-link" href="#sovereign-main">Skip to main content</a>
      <SovereignNeuralWeb />
      <div className="sovereign-grid" aria-hidden="true" />
      <div className="sovereign-vignette" aria-hidden="true" />

      <header className="sovereign-header">
        <Link to="/" className="sovereign-brand" aria-label="D3VONN.IO home">
          <span className="sovereign-mark"><img src="/d3vonn-icon.svg" alt="" /></span>
          <span>
            <strong>D3VONN.IO</strong>
            <small>SOVEREIGN SIGNAL</small>
          </span>
        </Link>

        <nav className="sovereign-nav" aria-label="Primary navigation">
          <Link to="/platform">PLATFORM</Link>
          <Link to="/marketplace">MARKETPLACE</Link>
          <Link to="/pricing">PRICING</Link>
          <Link to="/institute">INSTITUTE</Link>
          <Link to="/status">STATUS</Link>
          <Link to="/app" className="sovereign-nav-cta">ENTER SYSTEM</Link>
        </nav>
        <button className="sovereign-mobile-menu" type="button" aria-label="Open navigation" aria-expanded="false">
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
          {signalStates.map((state) => (
            <span key={state}><i />{state}</span>
          ))}
        </div>

        <div className="sovereign-telemetry" aria-label="Live platform telemetry" aria-live="polite">
          <div><small>ACTIVE AGENTS</small><strong>{telemetry.activeAgents}</strong></div>
          <div><small>WORKFLOWS TODAY</small><strong>{telemetry.workflowsToday}</strong></div>
          <div><small>KNOWLEDGE NODES</small><strong>{telemetry.knowledgeNodes}</strong></div>
          <div><small>SYSTEM STATUS</small><strong>{telemetry.systemStatus}</strong></div>
          <div><small>HERMES QUEUE</small><strong>{telemetry.hermesQueue}</strong></div>
        </div>
      </section>

      <SovereignFeatureDeck telemetry={telemetry} />

      <section className="sovereign-systems" aria-label="D3VONN systems">
        <div className="systems-heading">
          <span>ONE SIGNAL.</span>
          <span>MULTIPLE SYSTEMS.</span>
        </div>
        <div className="system-links">
          {systems.map((system) => (
            <Link key={system.label} to={system.href} className="system-link">
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
