import React, { lazy, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  ArrowRight,
  Boxes,
  BrainCircuit,
  Building2,
  Command,
  Eye,
  Factory,
  Landmark,
  Mic,
  Network,
  Plug,
  ShieldCheck,
  Stethoscope,
  Truck,
  Workflow,
} from 'lucide-react';

import '@/styles/d3os.css';
import BootSequence from '@/components/d3os/BootSequence';
import CorridorFallback from '@/components/d3os/CorridorFallback';
import FxBoundary from '@/components/d3os/FxBoundary';
import HermesCore from '@/components/d3os/HermesCore';
import KnowledgeConstellation from '@/components/d3os/KnowledgeConstellation';
import WorkflowPulse from '@/components/d3os/WorkflowPulse';
import AgentGrid from '@/components/d3os/AgentGrid';
import TelemetryPanels from '@/components/d3os/TelemetryPanels';
import OsNav from '@/components/d3os/OsNav';
import OsFooter from '@/components/d3os/OsFooter';
import { useInView, useMagnetic } from '@/components/d3os/os-hooks';
import SmartLaunchLink from '@/components/SmartLaunchLink';

const DataCorridor = lazy(() => import('@/components/d3os/DataCorridor'));

const SURFACES = [
  { label: 'Intelligent Agents', to: '/agents', icon: BrainCircuit, detail: 'Specialist AI workers with supervised execution.' },
  { label: 'Automation', to: '/workflows', icon: Workflow, detail: 'Operating procedures as observable workflows.' },
  { label: 'Knowledge', to: '/dkos-ingestion', icon: Network, detail: 'Documents and operations become connected intelligence.' },
  { label: 'Voice & Vision', to: '/voice-studio', icon: Mic, detail: 'Real-time speech, transcription and visual understanding.' },
  { label: 'Marketplace', to: '/marketplace', icon: Boxes, detail: 'Reusable agents, tools and connectors.' },
  { label: 'OCC', to: '/occ', icon: Command, detail: 'Operator command center for live system control.' },
];

const DOMAINS = [
  { label: 'Financial services', icon: Landmark, detail: 'Reconciliation, reporting and risk review under policy control.' },
  { label: 'Healthcare', icon: Stethoscope, detail: 'Intake, documentation and compliance-aware coordination.' },
  { label: 'Manufacturing', icon: Factory, detail: 'Supply signals, maintenance planning and quality analysis.' },
  { label: 'Logistics', icon: Truck, detail: 'Routing, exception handling and carrier communication.' },
  { label: 'Enterprise IT', icon: ShieldCheck, detail: 'Change review, incident triage and audit-ready trails.' },
  { label: 'Professional services', icon: Building2, detail: 'Research, proposals and client operations at scale.' },
];

const Section: React.FC<{
  id?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ id, children, className = '' }) => {
  const { ref, inView } = useInView<HTMLDivElement>(0.12);
  return (
    <section
      id={id}
      ref={ref}
      className={`scroll-mt-20 px-4 py-10 md:px-6 md:py-14 ${className}`}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0) scale(1)' : 'translateY(28px) scale(0.985)',
        transition: 'opacity 600ms cubic-bezier(0.22,1,0.36,1), transform 700ms cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      <div className="mx-auto w-full max-w-7xl">{children}</div>
    </section>
  );
};

const SectionHeader: React.FC<{ eyebrow: string; title: string; copy?: string }> = ({ eyebrow, title, copy }) => (
  <div className="max-w-3xl">
    <p className="os-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--os-ink-40)]">{eyebrow}</p>
    <h2 className="mt-3 text-2xl font-bold md:text-4xl">{title}</h2>
    {copy && <p className="mt-3 text-sm text-[color:var(--os-ink-60)] md:text-base">{copy}</p>}
  </div>
);

const Hero: React.FC = () => {
  const magnetic = useMagnetic<HTMLDivElement>(6);

  return (
    <section className="relative isolate overflow-hidden px-4 pb-10 pt-24 md:px-6 md:pb-14 md:pt-28">
      <div className="absolute inset-0 -z-10" aria-hidden="true">
        <FxBoundary fallback={<CorridorFallback />}>
          <DataCorridor />
        </FxBoundary>
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 lg:flex-row lg:items-center">
        <div className="os-rise flex-1">
          <span className="os-pill os-mono inline-flex items-center gap-2 px-3 py-1 text-[10px] uppercase tracking-[0.2em]">
            <span className="h-2 w-2 rounded-full" style={{ background: 'var(--os-lime-deep)' }} />
            Hermes core online
          </span>

          <h1 className="mt-6 text-2xl font-bold leading-[1.05] tracking-[-0.045em] md:text-4xl lg:text-[3.6rem]">
            The AI Business
            <br />
            Operating System.
          </h1>

          <p className="os-display mt-4 text-lg text-[color:var(--os-ink-60)] md:text-xl">
            One Platform, Infinite Intelligence.
          </p>

          <p className="mt-5 max-w-xl text-sm text-[color:var(--os-ink-60)] md:text-base">
            Run your agents, automations, knowledge, voice and operations on a single governed control plane — with
            Hermes orchestrating every request end to end.
          </p>

          <div ref={magnetic} className="os-magnetic mt-8 flex flex-col gap-3 sm:flex-row">
            <SmartLaunchLink
              authedTo="/app"
              className="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-[color:var(--os-ink)] bg-[color:var(--os-ink)] px-6 py-3 text-sm font-semibold text-[color:var(--os-pearl)] transition-colors hover:bg-[#25251f]"
            >
              Launch the OS <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </SmartLaunchLink>
            <Link
              to="/contact"
              className="inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-md border border-[color:var(--os-line)] bg-white/70 px-6 py-3 text-sm font-semibold transition-colors hover:border-[color:var(--os-ink)]"
            >
              Talk to the team
            </Link>
          </div>

          <dl className="mt-10 grid grid-cols-1 gap-4 border-t border-[color:var(--os-line-soft)] pt-6 sm:grid-cols-3">
            {[
              ['Hermes', 'Orchestration core'],
              ['DKOS', 'Knowledge system'],
              ['Guardian', 'Zero-trust policy'],
            ].map(([term, detail]) => (
              <div key={term}>
                <dt className="text-base font-semibold">{term}</dt>
                <dd className="os-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--os-ink-40)]">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex-1">
          <HermesCore />
        </div>
      </div>
    </section>
  );
};

const PortalCard: React.FC<{
  label: string;
  to: string;
  detail: string;
  icon: React.ElementType;
}> = ({ label, to, detail, icon: Icon }) => {
  const [hover, setHover] = useState(false);

  return (
    <Link
      to={to}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="os-card group relative cursor-pointer overflow-hidden p-4 md:p-5"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full transition-transform duration-500 ease-out"
        style={{
          background: 'radial-gradient(circle, rgba(183,224,23,0.32), rgba(255,122,26,0.12) 55%, transparent 72%)',
          transform: hover ? 'scale(1.6)' : 'scale(0.6)',
        }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <span className="os-chrome flex h-10 w-10 items-center justify-center rounded-md">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <ArrowRight
          className="h-4 w-4 text-[color:var(--os-ink-40)] transition-transform duration-200 group-hover:translate-x-1"
          aria-hidden="true"
        />
      </div>
      <h3 className="relative mt-6 text-lg font-semibold">{label}</h3>
      <p className="relative mt-2 text-sm text-[color:var(--os-ink-60)]">{detail}</p>
    </Link>
  );
};

const Index: React.FC = () => (
  <div className="d3os min-h-screen">
    <Helmet>
      <title>D3VONN.IO — The AI Business Operating System</title>
      <meta
        name="description"
        content="D3VONN.IO is the AI Business Operating System: intelligent agents, automation, knowledge, voice and vision, marketplace and an operator command center, orchestrated by Hermes."
      />
      <meta property="og:title" content="D3VONN.IO — The AI Business Operating System" />
      <meta
        property="og:description"
        content="One Platform, Infinite Intelligence. Orchestrate agents, automation, knowledge and operations from one governed control plane."
      />
      <meta property="og:url" content="https://d3vonn.io/" />
      <link rel="canonical" href="https://d3vonn.io/" />
    </Helmet>

    <BootSequence />
    <OsNav />

    <main id="os-main">
      <Hero />

      <Section id="surfaces">
        <SectionHeader
          eyebrow="Operating surfaces"
          title="Six surfaces. One operating system."
          copy="Each surface is a doorway into the same governed runtime — shared identity, shared policy, shared memory."
        />
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SURFACES.map((surface) => (
            <PortalCard key={surface.to} {...surface} />
          ))}
        </div>
      </Section>

      <Section id="workforce" className="bg-[color:var(--os-pearl-2)]">
        <SectionHeader
          eyebrow="AI workforce"
          title="A workforce you can actually supervise."
          copy="Every agent reports status, throughput and latency, and every action is traceable back to a policy."
        />
        <div className="mt-8">
          <AgentGrid />
        </div>
      </Section>

      <Section id="knowledge">
        <SectionHeader
          eyebrow="Knowledge graph"
          title="Connected intelligence, not scattered documents."
          copy="Agents, tools, memory and workflows form one living graph that Hermes reasons over."
        />
        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <KnowledgeConstellation />
          <div className="flex flex-col gap-4">
            <WorkflowPulse />
            <div className="os-card p-4 md:p-5">
              <h3 className="text-lg font-semibold">Governed by design</h3>
              <p className="mt-2 text-sm text-[color:var(--os-ink-60)]">
                Approval gates, audit trails, isolation and zero-trust policy are applied at every hop of the execution
                path — not bolted on afterwards.
              </p>
              <Link
                to="/security"
                className="mt-4 inline-flex cursor-pointer items-center gap-2 whitespace-nowrap text-sm font-semibold hover:underline"
              >
                Security & trust <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </Section>

      <Section id="domains" className="bg-[color:var(--os-pearl-2)]">
        <SectionHeader
          eyebrow="Domain intelligence"
          title="Tuned to how your industry actually operates."
        />
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DOMAINS.map(({ label, detail, icon: Icon }) => (
            <div key={label} className="os-card p-4 md:p-5">
              <Icon className="h-5 w-5" aria-hidden="true" />
              <h3 className="mt-5 text-base font-semibold">{label}</h3>
              <p className="mt-2 text-sm text-[color:var(--os-ink-60)]">{detail}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="marketplace">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="os-card p-4 md:p-5">
            <span className="os-pill os-mono inline-block px-3 py-1 text-[10px] uppercase tracking-[0.18em]">Marketplace</span>
            <h2 className="mt-5 text-2xl font-bold md:text-4xl">Deploy a capability in minutes.</h2>
            <p className="mt-3 text-sm text-[color:var(--os-ink-60)] md:text-base">
              Browse ready-made agents, tools and connectors, then deploy them into your own governed workspace with the
              permissions you choose.
            </p>
            <Link
              to="/marketplace"
              className="mt-6 inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md border border-[color:var(--os-ink)] px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-[rgba(14,14,12,0.05)]"
            >
              Browse marketplace <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="os-card p-4 md:p-5">
            <span className="os-pill os-mono inline-flex items-center gap-2 px-3 py-1 text-[10px] uppercase tracking-[0.18em]">
              <Mic className="h-3 w-3" aria-hidden="true" /> Voice studio
            </span>
            <h2 className="mt-5 text-2xl font-bold md:text-4xl">Agents that listen, speak and see.</h2>
            <p className="mt-3 text-sm text-[color:var(--os-ink-60)] md:text-base">
              Build real-time voice experiences and visual understanding into the same orchestration layer your text
              agents already run on.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['Live transcription', 'Low-latency speech', 'Vision analysis', 'Call operations'].map((tag) => (
                <span key={tag} className="os-pill os-mono px-3 py-1 text-[10px] uppercase tracking-[0.16em]">
                  {tag}
                </span>
              ))}
            </div>
            <Link
              to="/voice-studio"
              className="mt-6 inline-flex cursor-pointer items-center gap-2 whitespace-nowrap text-sm font-semibold hover:underline"
            >
              Open voice studio <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </Section>

      <Section id="telemetry" className="bg-[color:var(--os-pearl-2)]">
        <TelemetryPanels />
      </Section>

      <Section id="integrations">
        <SectionHeader
          eyebrow="Integrations"
          title="Connected to the systems you already run."
          copy="Cloud platforms, CRMs, data stores, edge devices and internal APIs plug into the same runtime."
        />
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {['AWS', 'Azure', 'Supabase', 'n8n', 'GitHub', 'Slack', 'Stripe', 'HubSpot', 'Notion', 'Postgres', 'Vercel', 'MCP'].map(
            (name) => (
              <div
                key={name}
                className="os-card flex items-center justify-center gap-2 px-3 py-4 text-sm font-medium"
              >
                <Plug className="h-4 w-4 text-[color:var(--os-ink-40)]" aria-hidden="true" />
                {name}
              </div>
            ),
          )}
        </div>
      </Section>

      <Section id="cta" className="bg-[color:var(--os-pearl-2)]">
        <div className="os-chrome relative overflow-hidden rounded-lg px-4 py-10 text-center md:px-6 md:py-14">
          <div className="absolute inset-0 os-grain opacity-50" aria-hidden="true" />
          <Eye className="relative mx-auto h-6 w-6" aria-hidden="true" />
          <h2 className="relative mt-5 text-2xl font-bold md:text-4xl">Put your whole operation under one command layer.</h2>
          <p className="relative mx-auto mt-3 max-w-2xl text-sm text-[color:var(--os-ink-60)] md:text-base">
            Start with one workflow, then scale into a full AI workforce — governed, observable and yours.
          </p>
          <div className="relative mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <SmartLaunchLink
              authedTo="/app"
              className="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-[color:var(--os-ink)] bg-[color:var(--os-ink)] px-6 py-3 text-sm font-semibold text-[color:var(--os-pearl)] transition-colors hover:bg-[#25251f]"
            >
              Launch the OS <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </SmartLaunchLink>
            <Link
              to="/pricing"
              className="inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-md border border-[color:var(--os-line)] bg-white/70 px-6 py-3 text-sm font-semibold transition-colors hover:border-[color:var(--os-ink)]"
            >
              See pricing
            </Link>
          </div>
        </div>
      </Section>
    </main>

    <OsFooter />
  </div>
);

export default Index;
