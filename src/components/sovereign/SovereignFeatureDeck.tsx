import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { HomepageTelemetry } from '@/lib/homepageTelemetry';
import '@/styles/sovereign-feature-deck.css';

type Props = {
  telemetry: HomepageTelemetry;
};

const surfaces = [
  {
    id: '01',
    label: 'HERMES COMMAND',
    href: '/occ',
    description: 'Direct governed agent execution, approvals, queues, and operational oversight.',
    status: 'COMMAND',
  },
  {
    id: '02',
    label: 'VOICE INTELLIGENCE',
    href: '/voice-studio',
    description: 'Talk to D3VONN through the production voice surface while keeping text control available.',
    status: 'VOICE',
  },
  {
    id: '03',
    label: 'AGENT MARKETPLACE',
    href: '/marketplace',
    description: 'Discover and launch governed specialist agents already connected to the D3VONN ecosystem.',
    status: 'DISCOVER',
  },
  {
    id: '04',
    label: 'AI FILMS',
    href: '/film',
    description: 'Move from concept and roles through generation, sound, rendering, and production workflows.',
    status: 'CREATE',
  },
  {
    id: '05',
    label: 'MONEYHUB',
    href: '/moneyhub',
    description: 'Operate the business and financial intelligence surface without exposing private controls publicly.',
    status: 'OPERATE',
  },
  {
    id: '06',
    label: 'KNOWLEDGE',
    href: '/dkos-ingestion',
    description: 'Feed governed knowledge into D3VONN and connect it to agent reasoning and retrieval.',
    status: 'LEARN',
  },
];

const applyMotionPreference = (reduced: boolean) => {
  document.documentElement.dataset.sovereignMotion = reduced ? 'reduced' : 'full';
  document.documentElement.classList.toggle('sovereign-motion-reduced', reduced);
};

const SovereignFeatureDeck: React.FC<Props> = ({ telemetry }) => {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem('d3vonn-reduce-motion');
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const next = saved === 'true' || (saved === null && prefersReduced);
    setReducedMotion(next);
    applyMotionPreference(next);
  }, []);

  const toggleMotion = () => {
    const next = !reducedMotion;
    setReducedMotion(next);
    window.localStorage.setItem('d3vonn-reduce-motion', String(next));
    applyMotionPreference(next);
    window.dispatchEvent(new CustomEvent('d3vonn-motion-change', { detail: { reduced: next } }));
    window.dispatchEvent(new CustomEvent('sovereign-motion-change', { detail: { reduced: next } }));
  };

  return (
    <section className="sovereign-feature-deck" aria-labelledby="sovereign-feature-title">
      <div className="feature-deck-heading">
        <div>
          <p className="feature-deck-kicker">D3VONN // OPERATING SURFACES</p>
          <h2 id="sovereign-feature-title">One intelligence. Multiple command surfaces.</h2>
        </div>
        <div className="feature-deck-controls">
          <Link to="/pricing" className="feature-deck-link">VIEW PLANS</Link>
          <Link to="/status" className="feature-deck-link feature-deck-status" aria-label={`System status: ${telemetry.systemStatus}`}>
            <i aria-hidden="true" /> {telemetry.systemStatus}
          </Link>
          <button type="button" className="motion-toggle" onClick={toggleMotion} aria-pressed={reducedMotion}>
            {reducedMotion ? 'ENABLE MOTION' : 'REDUCE MOTION'}
          </button>
        </div>
      </div>

      <div className="feature-deck-grid">
        {surfaces.map((surface) => (
          <Link key={surface.id} to={surface.href} className="feature-deck-card">
            <div className="feature-card-topline">
              <span>{surface.id}</span>
              <span>{surface.status}</span>
            </div>
            <h3>{surface.label}</h3>
            <p>{surface.description}</p>
            <span className="feature-card-open">OPEN SURFACE <b aria-hidden="true">↗</b></span>
          </Link>
        ))}
      </div>

      <div className="feature-deck-live" aria-live="polite">
        <div>
          <small>ACTIVE AGENTS</small>
          <strong>{telemetry.activeAgents}</strong>
        </div>
        <div>
          <small>HERMES QUEUE</small>
          <strong>{telemetry.hermesQueue}</strong>
        </div>
        <div>
          <small>WORKFLOWS TODAY</small>
          <strong>{telemetry.workflowsToday}</strong>
        </div>
        <Link to="/voice-studio" className="feature-deck-voice">
          <span className="voice-aperture" aria-hidden="true"><i /><i /><i /></span>
          <span><small>VOICE CONTROL</small><strong>START CONVERSATION</strong></span>
        </Link>
      </div>
    </section>
  );
};

export default SovereignFeatureDeck;
