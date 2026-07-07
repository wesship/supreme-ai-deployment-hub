import React, { lazy, Suspense } from 'react';
import { useScroll, useSpring, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Footer from '@/components/Footer';
import SmartLaunchLink from '@/components/SmartLaunchLink';
import './D3VonnHome.css';

const PORTAL_SRC = '/d3vonn-vault-portal.svg';
const BelowFoldSections = lazy(() => import('@/components/index/BelowFoldSections'));

const capabilities = [
  ['Hermes Routing', 'Routes goals into governed agent execution.'],
  ['DKOS Knowledge', 'Keeps business memory structured and searchable.'],
  ['RAG Memory', 'Grounds agents in the right context.'],
  ['Signal Security', 'Protects access, data, and operations.'],
];

const agents = [
  ['Hermes', 'Executive routing and task authority.'],
  ['Strategist', 'Market, growth, and decision support.'],
  ['Operator', 'Workflow automation and system follow-through.'],
  ['Creator', 'Content, visuals, code, and launch support.'],
];

function Hero() {
  return (
    <section className="d3-hero" aria-label="D3VONN.IO landing page">
      <div className="d3-shell d3-hero-grid">
        <div>
          <p className="d3-pill">AI WORKFORCE. LIMITLESS POTENTIAL.</p>
          <p className="d3-eyebrow">THE AI BUSINESS OPERATING SYSTEM</p>
          <h1>Welcome to D3VONN.IO</h1>
          <p className="d3-hero-titleline">D3VONN.IO — The World’s First AI Business Operating System</p>
          <p className="d3-hero-lede">
            D3VONN.IO orchestrates your AI workforce through Hermes, DKOS, RAG memory, signal security,
            and agent execution under one command layer.
          </p>
          <div className="d3-actions">
            <SmartLaunchLink authedTo="/app" className="d3-button d3-button-primary">Launch D3VONN</SmartLaunchLink>
            <Link to="/#platform" className="d3-button d3-button-secondary">Explore Platform</Link>
          </div>
          <p className="d3-secure-note">Secure. Private. Built for the Future.</p>
        </div>

        <div className="d3-portal-card">
          <img src={PORTAL_SRC} alt="Metallic D3VONN.IO vault portal" loading="eager" decoding="async" />
          <div className="d3-status-card d3-status-a"><span>Hermes Routing</span><strong>READY</strong></div>
          <div className="d3-status-card d3-status-b"><span>DKOS Memory</span><strong>ONLINE</strong></div>
          <div className="d3-status-card d3-status-c"><span>Agent Workforce</span><strong>ACTIVE</strong></div>
        </div>
      </div>
    </section>
  );
}

function Platform() {
  return (
    <section id="platform" className="d3-section">
      <div className="d3-shell d3-section-grid">
        <div className="d3-section-header">
          <p className="d3-eyebrow">THE D3VONN PLATFORM</p>
          <h2>One command layer for agents, memory, and automation.</h2>
          <p>
            DEVONN.AI runs through practical system layers: Hermes routes the work, DKOS structures the knowledge,
            RAG supports grounded answers, and the security layer protects execution.
          </p>
        </div>
        <div className="d3-card-grid">
          {capabilities.map(([title, body]) => (
            <article className="d3-card" key={title}>
              <strong>{title}</strong>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Agents() {
  return (
    <section className="d3-section d3-section-tight">
      <div className="d3-shell">
        <div className="d3-section-header">
          <p className="d3-eyebrow">AI AGENT WORKFORCE</p>
          <h2>Specialized agents under Hermes control.</h2>
          <p>Each agent has a defined role, a command path, and a reason to exist inside D3VONN.IO.</p>
        </div>
        <div className="d3-agent-grid">
          {agents.map(([name, body]) => (
            <article className="d3-agent" key={name}>
              <span className="d3-agent-orb" aria-hidden="true" />
              <strong>{name}</strong>
              <p>{body}</p>
              <Link to="/agents">Open {name}</Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function CommandCenter() {
  const metrics = [
    ['99.9%', 'Uptime'],
    ['256-bit', 'Encryption'],
    ['24/7', 'Operations'],
    ['Global', 'Infrastructure'],
  ];

  return (
    <section className="d3-section">
      <div className="d3-shell d3-command-panel">
        <div className="d3-section-header">
          <p className="d3-eyebrow">YOUR AI COMMAND CENTER</p>
          <h2>Everything you need in one operating system.</h2>
          <p>Manage agents, workflows, knowledge, security, and approvals from a focused executive interface.</p>
        </div>
        <div className="d3-metrics">
          {metrics.map(([value, label]) => (
            <span key={label}><strong>{value}</strong><small>{label}</small></span>
          ))}
        </div>
        <div className="d3-actions">
          <SmartLaunchLink authedTo="/app" className="d3-button d3-button-primary">Launch Command Center</SmartLaunchLink>
          <Link to="/security/command-center" className="d3-button d3-button-secondary">View Security Layer</Link>
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="d3-section d3-section-tight">
      <div className="d3-shell d3-cta-panel">
        <p className="d3-eyebrow">D3VONN.IO</p>
        <h2>The vault is open.</h2>
        <p>Build your command layer with agents, memory, automation, and secure execution.</p>
        <div className="d3-actions">
          <SmartLaunchLink authedTo="/app" className="d3-button d3-button-primary">Start Building</SmartLaunchLink>
          <Link to="/contact" className="d3-button d3-button-secondary">Book a Demo</Link>
        </div>
      </div>
    </section>
  );
}

const Index: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });
  const title = 'D3VONN.IO — The AI Business Operating System';
  const description = 'D3VONN.IO is the intelligence gateway for DEVONN.AI: Hermes orchestration, DKOS knowledge, RAG memory, secure automation, and agent workforce execution.';

  return (
    <div className="d3-home">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href="https://d3vonn.io/" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content="https://d3vonn.io/" />
        <meta property="og:type" content="website" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <link rel="preload" as="image" href={PORTAL_SRC} />
      </Helmet>
      <motion.div className="d3-progress" style={{ scaleX }} />
      <main id="main-content">
        <Hero />
        <Platform />
        <Agents />
        <CommandCenter />
        <FinalCTA />
        <Suspense fallback={<div className="d3-section d3-shell">Loading D3VONN modules...</div>}>
          <BelowFoldSections />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
