import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useScroll, useSpring, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Footer from '@/components/Footer';
import SmartLaunchLink from '@/components/SmartLaunchLink';
import './D3VonnHome.css';

const MASTER_LOGO_SRC = '/d3vonn-logo-live.svg';

const BelowFoldSections = lazy(() => import('@/components/index/BelowFoldSections'));

type Telemetry = {
  activeAgents: string;
  workflowsToday: string;
  knowledgeNodes: string;
  systemStatus: string;
  hermesQueue: string;
};

const defaultTelemetry: Telemetry = {
  activeAgents: 'Live',
  workflowsToday: '41/41',
  knowledgeNodes: '573+',
  systemStatus: 'Optimal',
  hermesQueue: 'Ready',
};

const useHomepageTelemetry = () => {
  const [telemetry, setTelemetry] = useState<Telemetry>(defaultTelemetry);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const [overview, occ] = await Promise.allSettled([
          fetch('/api/admin/overview', { signal: controller.signal }).then((r) => (r.ok ? r.json() : null)),
          fetch('/api/occ/stats', { signal: controller.signal }).then((r) => (r.ok ? r.json() : null)),
        ]);

        const overviewValue = overview.status === 'fulfilled' ? overview.value : null;
        const occValue = occ.status === 'fulfilled' ? occ.value : null;

        setTelemetry({
          activeAgents: String(overviewValue?.active_agents ?? overviewValue?.agents_active ?? defaultTelemetry.activeAgents),
          workflowsToday: String(occValue?.workflows_today ?? occValue?.tasks_completed ?? defaultTelemetry.workflowsToday),
          knowledgeNodes: String(overviewValue?.knowledge_nodes ?? occValue?.rag_documents ?? defaultTelemetry.knowledgeNodes),
          systemStatus: String(overviewValue?.status ?? occValue?.status ?? defaultTelemetry.systemStatus),
          hermesQueue: String(occValue?.hermes_queue ?? overviewValue?.queue_status ?? defaultTelemetry.hermesQueue),
        });
      } catch {
        setTelemetry(defaultTelemetry);
      }
    };

    load();
    return () => controller.abort();
  }, []);

  return telemetry;
};

const CommandPanel = ({ className, label, value }: { className: string; label: string; value: string }) => (
  <div className={`d3-command-panel ${className}`}>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

const Hero = ({ telemetry }: { telemetry: Telemetry }) => (
  <section aria-label="D3VONN.IO sovereign agent operating system" className="d3-hero">
    <div className="d3-shell d3-hero-grid">
      <div className="d3-hero-copy">
        <p className="d3-eyebrow">D3VONN.IO // Sovereign Agent OS</p>
        <h1>
          Command the Signal.
          <br />
          Deploy the Agents.
          <br />
          Build the Operating System.
        </h1>
        <p className="d3-hero-lede">
          D3VONN.IO is the intelligence gateway for DEVONN.AI — a sovereign agent operating system built for automation,
          memory, security, orchestration, and real-world business execution.
        </p>
        <div className="d3-hero-actions">
          <SmartLaunchLink authedTo="/app" className="d3-button d3-button-primary">
            Enter Command Layer
          </SmartLaunchLink>
          <Link to="/#platform" className="d3-button d3-button-secondary">
            View Intelligence Stack
          </Link>
        </div>
        <div className="d3-status-strip" aria-label="D3VONN live system status">
          <span>Hermes {telemetry.hermesQueue}</span>
          <span>DKOS Memory Online</span>
          <span>{telemetry.knowledgeNodes} Knowledge Nodes</span>
          <span>Security Layer Armed</span>
        </div>
      </div>

      <div className="d3-command-visual" aria-label="D3VONN intelligence routing visual">
        <div className="d3-orb" />
        <CommandPanel className="d3-panel-top" label="Hermes Routing" value="ACTIVE" />
        <CommandPanel className="d3-panel-middle" label="DKOS Memory" value="SYNCING" />
        <CommandPanel className="d3-panel-bottom" label="Agent Workforce" value={telemetry.activeAgents} />
      </div>
    </div>
  </section>
);

const StackSection = ({ telemetry }: { telemetry: Telemetry }) => {
  const layers = [
    ['Hermes Orchestrator', 'Routes intent into tasks, dependencies, checkpoints, and governed execution.'],
    ['DKOS Knowledge Layer', 'Structures uploads, memory, concepts, and reusable intelligence for agents.'],
    ['RAG Memory', `${telemetry.knowledgeNodes} indexed nodes keep the system grounded in your operating context.`],
    ['Agent Workforce', 'Security, research, CodeOps, voice, brand, finance, and workflow agents operate under command authority.'],
    ['Deployment Layer', 'Vercel, Railway, Supabase, Pinecone, Docker, and VPS/Kubernetes pathways stay visible and testable.'],
  ];

  return (
    <section id="platform" className="d3-section">
      <div className="d3-shell d3-stack-grid">
        <div className="d3-section-header">
          <p className="d3-eyebrow">Intelligence Stack</p>
          <h2>Systems, not pages.</h2>
          <p>
            The homepage now presents D3VONN.IO as layered infrastructure: Hermes routes the work, DKOS holds the knowledge,
            RAG grounds the memory, and the agent workforce executes the mission.
          </p>
        </div>
        <div className="d3-layer-list">
          {layers.map(([title, body]) => (
            <article className="d3-layer-card" key={title}>
              <strong>{title}</strong>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

const SignalFlow = () => (
  <section className="d3-section">
    <div className="d3-shell d3-stack-grid">
      <div className="d3-flow-map" aria-label="D3VONN signal flow map">
        <div className="d3-flow-line" />
        <span className="d3-flow-node d3-flow-a">Intent</span>
        <span className="d3-flow-node d3-flow-b">Knowledge Graph</span>
        <span className="d3-flow-node d3-flow-c">Hermes</span>
        <span className="d3-flow-node d3-flow-d">Agents</span>
        <span className="d3-flow-node d3-flow-e">Execution</span>
      </div>
      <div className="d3-section-header">
        <p className="d3-eyebrow">Signal Flow</p>
        <h2>From command to governed action.</h2>
        <p>
          A business goal enters the signal layer, gets enriched by the knowledge graph, routed through Hermes, executed by
          specialist agents, and returned with status, memory, and audit trail intact.
        </p>
      </div>
    </div>
  </section>
);

const AgentRail = () => {
  const agents = [
    ['Security Agent', 'SOC detection, incident triage, and hardened response.'],
    ['Research Agent', 'Deep-dive market, product, and competitive intelligence.'],
    ['CodeOps Agent', 'Repository scans, implementation plans, tests, and PR support.'],
    ['Voice Agent', 'Human-facing conversational interface for the command layer.'],
    ['Brand Agent', 'HNF THE BRAND, campaign, cinematic, and launch systems.'],
    ['Finance Agent', 'Deal logic, portfolio review, and business planning support.'],
    ['Workflow Agent', 'n8n-style automations and repeatable business execution.'],
    ['Compliance Agent', 'Policy, risk, review checkpoints, and human approval flows.'],
  ];

  return (
    <section className="d3-section">
      <div className="d3-shell">
        <div className="d3-section-header">
          <p className="d3-eyebrow">Agent Workforce</p>
          <h2>Specialists under Hermes control.</h2>
          <p>
            D3VONN.IO should make the agent system feel operational, not imaginary. Every agent class points toward a real
            dashboard, queue, review flow, or business function.
          </p>
        </div>
        <div className="d3-agent-grid">
          {agents.map(([name, body], index) => (
            <article className="d3-agent-card" key={name}>
              <span className="d3-agent-meta">Agent {String(index + 1).padStart(2, '0')}</span>
              <strong>{name}</strong>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

const TrustLayer = () => {
  const controls = [
    ['Auth + RBAC', 'Protected operator routes and role-aware access patterns.'],
    ['Secret Validation', 'Deployment hardening keeps missing keys from silently breaking production.'],
    ['Observability', 'Status, queues, agent runs, and operational health remain visible.'],
    ['SOC Surface', 'Security command center, alerts, incidents, and automated response planning.'],
    ['Supabase + Pinecone', 'Structured data, auth, vector memory, and DKOS retrieval pathways.'],
    ['Vercel Preview Gate', 'Design and visual regression checks before production promotion.'],
  ];

  return (
    <section className="d3-section">
      <div className="d3-shell">
        <div className="d3-section-header">
          <p className="d3-eyebrow">Trust Layer</p>
          <h2>Luxury-tech look. Production-grade posture.</h2>
          <p>
            The visual system now reinforces the real backend story: secure auth, audited execution, deployment checks,
            agent supervision, and hardened operating surfaces.
          </p>
        </div>
        <div className="d3-trust-grid">
          {controls.map(([name, body]) => (
            <article className="d3-trust-card" key={name}>
              <span className="d3-card-label">Control</span>
              <strong>{name}</strong>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

const VisionLayer = () => {
  const vision = [
    ['The Signal', 'The public gateway and command identity for D3VONN.IO.'],
    ['The Door', 'The entry point into the agent workforce, knowledge system, and operator console.'],
    ['Smart Glasses', 'Future hardware direction connected to D3VONN.IO and HNF THE BRAND.'],
    ['Global Mission', 'Mile High Golden Elevation, nonprofit pathways, Dubai structure, and business expansion.'],
  ];

  return (
    <section className="d3-section">
      <div className="d3-shell">
        <div className="d3-section-header">
          <p className="d3-eyebrow">Vision Layer</p>
          <h2>The brand system points beyond the website.</h2>
          <p>
            D3VONN.IO becomes the flagship signal for software, agents, hardware, media, brand, and future international
            execution.
          </p>
        </div>
        <div className="d3-vision-grid">
          {vision.map(([name, body]) => (
            <article className="d3-vision-card" key={name}>
              <span className="d3-card-label">D3VONN</span>
              <strong>{name}</strong>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

const FinalCTA = () => (
  <section className="d3-section d3-cta">
    <div className="d3-shell d3-cta-panel">
      <p className="d3-eyebrow">Mission Control</p>
      <div className="d3-section-header">
        <h2>Enter the command layer.</h2>
        <p>
          Launch the operator experience, review the intelligence stack, or move deeper into agents, workflows, DKOS, and security.
        </p>
      </div>
      <div className="d3-hero-actions">
        <SmartLaunchLink authedTo="/app" className="d3-button d3-button-primary">
          Launch D3VONN.IO
        </SmartLaunchLink>
        <Link to="/security/command-center" className="d3-button d3-button-secondary">
          View Security Command
        </Link>
      </div>
    </div>
  </section>
);

const Index: React.FC = () => {
  const telemetry = useHomepageTelemetry();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  const title = 'D3VONN.IO — Sovereign Agent Operating System';
  const description =
    'D3VONN.IO is the intelligence gateway for DEVONN.AI: Hermes orchestration, DKOS knowledge, RAG memory, secure automation, and agent workforce execution.';
  const url = 'https://d3vonn.io/';

  return (
    <div className="d3-home">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="website" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <link rel="preload" as="image" href={MASTER_LOGO_SRC} />
      </Helmet>

      <motion.div className="d3-progress" style={{ scaleX }} />

      <main id="main-content">
        <Hero telemetry={telemetry} />
        <StackSection telemetry={telemetry} />
        <SignalFlow />
        <AgentRail />
        <TrustLayer />
        <VisionLayer />
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
