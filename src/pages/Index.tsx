import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useScroll, useSpring, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Footer from '@/components/Footer';
import SmartLaunchLink from '@/components/SmartLaunchLink';
import './D3VonnHome.css';

const PORTAL_SRC = '/d3vonn-vault-portal.svg';
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
  <section aria-label="D3VONN.IO sovereign agent operating system" className="d3-hero d3-vault-hero">
    <div className="d3-shell d3-hero-grid">
      <div className="d3-hero-copy">
        <p className="d3-pill">AI WORKFORCE. LIMITLESS POTENTIAL.</p>
        <p className="d3-eyebrow">THE AI BUSINESS OPERATING SYSTEM</p>
        <h1 className="d3-metal-heading">
          Welcome to
          <br />
          D3VONN<span>.IO</span>
        </h1>
        <p className="d3-hero-titleline">The World’s First AI Business Operating System</p>
        <p className="d3-hero-lede">
          Orchestrate your AI workforce. Automate operations. Scale through Hermes, DKOS, RAG memory, secure workflows,
          and agent execution under one command layer.
        </p>
        <div className="d3-hero-actions">
          <SmartLaunchLink authedTo="/app" className="d3-button d3-button-primary">
            Launch D3VONN
          </SmartLaunchLink>
          <Link to="/#platform" className="d3-button d3-button-secondary">
            Explore Platform
          </Link>
        </div>
        <div className="d3-secure-note">Secure. Private. Built for the Future.</div>
      </div>

      <div className="d3-portal-stage" aria-label="D3VONN vault portal visual">
        <img src={PORTAL_SRC} alt="Metallic D3VONN vault portal" loading="eager" decoding="async" />
        <CommandPanel className="d3-panel-top" label="Hermes Routing" value={telemetry.hermesQueue} />
        <CommandPanel className="d3-panel-middle" label="DKOS Memory" value="ONLINE" />
        <CommandPanel className="d3-panel-bottom" label="Agent Workforce" value={telemetry.activeAgents} />
      </div>
    </div>

    <div className="d3-shell d3-feature-rail" aria-label="D3VONN platform capabilities">
      <span><strong>Multi-Agent Orchestration</strong><small>Deploy intelligent AI teams</small></span>
      <span><strong>Memory & Knowledge</strong><small>Persistent. Private. Powerful.</small></span>
      <span><strong>Automation at Scale</strong><small>Workflows that work for you</small></span>
      <span><strong>Secure by Design</strong><small>Enterprise-grade security</small></span>
      <span><strong>Real-Time Intelligence</strong><small>Insights that drive impact</small></span>
    </div>
  </section>
);

const PlatformAgents = () => {
  const agents = [
    ['Hermes', 'AI EXECUTIVE ASSISTANT', 'Your always-on assistant that thinks, acts, routes, and executes.'],
    ['Strategist', 'AI BUSINESS STRATEGIST', 'Market intelligence, strategy generation, and competitive advantage.'],
    ['Operator', 'AI OPERATIONS AGENT', 'Automate workflows, manage systems, and optimize operations.'],
    ['Creator', 'AI CONTENT STUDIO', 'Create content, visuals, code, and campaigns inside the command layer.'],
  ];

  return (
    <section id="platform" className="d3-section d3-platform-section">
      <div className="d3-shell d3-platform-grid">
        <div className="d3-section-header">
          <p className="d3-eyebrow">THE D3VONN PLATFORM</p>
          <h2>One Platform. Infinite Possibilities.</h2>
          <p>
            D3VONN.IO is more than software. It is your operating system for the AI era: Hermes orchestration, DKOS knowledge,
            secure automation, and agent execution.
          </p>
          <Link to="/agents" className="d3-button d3-button-primary d3-small-button">See All Agents</Link>
        </div>
        <div className="d3-agent-showcase">
          {agents.map(([name, title, body]) => (
            <article className="d3-agent-portrait" key={name}>
              <div className="d3-portrait-glow" />
              <span className="d3-agent-silhouette" aria-hidden="true" />
              <h3>{name}</h3>
              <p className="d3-agent-role">{title}</p>
              <p>{body}</p>
              <Link to="/agents">Open {name}</Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

const CommandCenterSection = ({ telemetry }: { telemetry: Telemetry }) => (
  <section className="d3-section d3-command-center-section">
    <div className="d3-shell d3-command-center-grid">
      <div className="d3-section-header">
        <p className="d3-eyebrow">YOUR AI COMMAND CENTER</p>
        <h2>Everything You Need. All in One OS.</h2>
        <p>
          Manage agents, data, workflows, projects, knowledge, and approvals from a single executive interface built for
          the D3VONN mission.
        </p>
        <ul className="d3-command-list">
          <li>Real-time dashboards</li>
          <li>Knowledge vault</li>
          <li>Workflow automation</li>
          <li>Agent collaboration</li>
          <li>Secure data layer</li>
        </ul>
        <SmartLaunchLink authedTo="/app" className="d3-button d3-button-primary d3-small-button">
          Launch Command Center
        </SmartLaunchLink>
      </div>
      <div className="d3-dashboard-frame">
        <div className="d3-dashboard-topbar"><span>D3VONN Command Center</span><strong>Live</strong></div>
        <div className="d3-dashboard-grid">
          <div><span>Active Agents</span><strong>{telemetry.activeAgents}</strong></div>
          <div><span>Tasks Completed</span><strong>{telemetry.workflowsToday}</strong></div>
          <div><span>Success Rate</span><strong>98.7%</strong></div>
          <div><span>Uptime</span><strong>99.9%</strong></div>
        </div>
        <div className="d3-world-map" aria-hidden="true"><span /></div>
        <div className="d3-live-feed">
          <strong>Live Feed</strong>
          <p>Hermes completed market analysis</p>
          <p>Operator automated client onboarding</p>
          <p>Strategist generated growth plan</p>
        </div>
      </div>
    </div>
  </section>
);

const IntelligenceStack = ({ telemetry }: { telemetry: Telemetry }) => {
  const layers = [
    ['Hermes Orchestrator', 'Routes intent into tasks, dependencies, checkpoints, and governed execution.'],
    ['DKOS Knowledge Layer', 'Structures uploads, memory, concepts, and reusable intelligence for agents.'],
    ['RAG Memory', `${telemetry.knowledgeNodes} indexed nodes keep the system grounded in your operating context.`],
    ['Agent Workforce', 'Security, research, CodeOps, voice, brand, finance, and workflow agents operate under command authority.'],
    ['Deployment Layer', 'Vercel, Railway, Supabase, Pinecone, Docker, and VPS/Kubernetes pathways stay visible and testable.'],
  ];

  return (
    <section className="d3-section">
      <div className="d3-shell d3-stack-grid">
        <div className="d3-section-header">
          <p className="d3-eyebrow">INTELLIGENCE STACK</p>
          <h2>Build. Deploy. Scale. Without Limits.</h2>
          <p>
            The website now follows your landing-page direction: metallic blue, cinematic, vault-like, agent-focused, and
            tied directly to the DEVONN.AI architecture.
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
        <p className="d3-eyebrow">SIGNAL FLOW</p>
        <h2>From command to governed action.</h2>
        <p>
          A business goal enters the signal layer, gets enriched by the knowledge graph, routed through Hermes, executed by
          specialist agents, and returned with status, memory, and audit trail intact.
        </p>
      </div>
    </div>
  </section>
);

const TrustLayer = () => {
  const controls = [
    ['99.9%', 'System Uptime'],
    ['∞', 'Scalable Agents'],
    ['256-bit', 'End-to-End Encryption'],
    ['24/7', 'Autonomous Operations'],
    ['Global', 'Secure Infrastructure'],
  ];

  return (
    <section className="d3-section d3-metrics-section">
      <div className="d3-shell d3-metrics-bar">
        {controls.map(([value, label]) => (
          <span key={label}><strong>{value}</strong><small>{label}</small></span>
        ))}
      </div>
      <div className="d3-shell d3-trusted-row" aria-label="D3VONN ecosystem integrations">
        <span>OpenAI</span><span>Anthropic</span><span>Google Cloud</span><span>AWS</span><span>Microsoft Azure</span><span>Supabase</span><span>Railway</span><span>Vercel</span>
      </div>
    </section>
  );
};

const FinalCTA = () => (
  <section className="d3-section d3-cta">
    <div className="d3-shell d3-cta-panel">
      <p className="d3-eyebrow">THE FUTURE IS AUTOMATED. THE FUTURE IS D3VONN.</p>
      <div className="d3-section-header">
        <h2>The Vault Is Open.</h2>
        <p>
          Join the AI revolution. Build your empire. Let your workforce do the rest through D3VONN.IO.
        </p>
      </div>
      <div className="d3-hero-actions">
        <SmartLaunchLink authedTo="/app" className="d3-button d3-button-primary">
          Start Building
        </SmartLaunchLink>
        <Link to="/contact" className="d3-button d3-button-secondary">
          Book a Demo
        </Link>
      </div>
    </div>
  </section>
);

const Index: React.FC = () => {
  const telemetry = useHomepageTelemetry();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  const title = 'D3VONN.IO — The AI Business Operating System';
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
        <link rel="preload" as="image" href={PORTAL_SRC} />
      </Helmet>

      <motion.div className="d3-progress" style={{ scaleX }} />

      <main id="main-content">
        <Hero telemetry={telemetry} />
        <PlatformAgents />
        <CommandCenterSection telemetry={telemetry} />
        <TrustLayer />
        <IntelligenceStack telemetry={telemetry} />
        <SignalFlow />
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
