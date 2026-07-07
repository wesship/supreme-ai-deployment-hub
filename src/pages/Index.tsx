import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useScroll, useSpring, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  ArrowRight,
  ShieldCheck,
  Database,
  Workflow,
  Settings,
  Shield,
  Lightbulb,
  Play,
  Users,
  Network,
  BookOpen,
  Clapperboard,
  ShoppingCart,
  Code2,
  Cloud,
  Activity,
  RadioTower,
  Lock,
  Cpu,
  LineChart,
  Bot,
} from 'lucide-react';
import Footer from '@/components/Footer';
import KnowledgeGraphPreview from '@/components/home/KnowledgeGraphPreview';
import SmartLaunchLink from '@/components/SmartLaunchLink';
import {
  defaultHomepageTelemetry,
  fetchHomepageTelemetry,
  type HomepageTelemetry,
} from '@/lib/homepageTelemetry';

const MASTER_LOGO_SRC = '/d3vonn-logo-live.svg';

const useHomepageTelemetry = () => {
  const [telemetry, setTelemetry] = useState<HomepageTelemetry>(defaultHomepageTelemetry);

  useEffect(() => {
    const controller = new AbortController();

    fetchHomepageTelemetry(controller.signal).then(setTelemetry);

    return () => controller.abort();
  }, []);

  return telemetry;
};

const GlassCard: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...rest
}) => (
  <div
    {...rest}
    className={
      'relative rounded-2xl border border-blue-300/15 bg-blue-400/[0.04] p-6 backdrop-blur-xl ' +
      'shadow-[0_0_40px_-12px_rgba(56,136,255,0.28)] transition-all duration-300 ' +
      'hover:border-blue-400/45 hover:shadow-[0_0_60px_-8px_rgba(56,136,255,0.5)] hover:-translate-y-0.5 ' +
      className
    }
  >
    {children}
  </div>
);

const HeroLogoMark: React.FC = () => (
  <div className="relative mx-auto w-[94vw] max-w-[980px] overflow-visible py-1 sm:w-[90vw] lg:w-full lg:max-w-[900px] xl:max-w-[980px]">
    <div className="absolute inset-x-[-10%] top-1/2 h-96 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(0,168,255,0.58),rgba(0,84,180,0.24)_45%,rgba(6,38,92,0.1)_66%,transparent_82%)] blur-2xl" />
    <div className="absolute inset-x-[-8%] top-[48%] h-72 -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,transparent,rgba(29,142,255,0.34),transparent)] blur-xl" />
    <div className="absolute inset-x-[6%] bottom-[8%] h-12 rounded-full bg-blue-400/25 blur-2xl" />
    <img
      src={MASTER_LOGO_SRC}
      alt="D3VONN.IO cinematic blue logo — The AI Business Operating System"
      className="relative z-10 w-full object-contain object-center opacity-[0.98] drop-shadow-[0_0_64px_rgba(0,163,255,0.78)] transition duration-700 hover:scale-[1.01]"
      draggable={false}
      loading="eager"
      decoding="async"
    />
    <div className="pointer-events-none absolute inset-x-[-8%] top-0 h-24 bg-gradient-to-b from-[#073878]/40 via-[#073878]/10 to-transparent" />
    <div className="pointer-events-none absolute inset-x-[-8%] bottom-0 h-28 bg-gradient-to-t from-[#031f4f] via-[#031f4f]/30 to-transparent" />
  </div>
);

const BinaryRain: React.FC = () => (
  <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-35" aria-hidden="true">
    {Array.from({ length: 18 }).map((_, i) => (
      <motion.div
        key={i}
        className="absolute top-[-40%] whitespace-pre text-[10px] leading-5 tracking-[0.38em] text-blue-200/60"
        style={{ left: `${i * 6.1}%` }}
        animate={{ y: ['0%', '160%'] }}
        transition={{ duration: 16 + (i % 6), repeat: Infinity, ease: 'linear', delay: i * 0.45 }}
      >
        {'01 10 11 00 01 11 10 01 00 11 01 10\n'.repeat(18)}
      </motion.div>
    ))}
  </div>
);

const PanelLink: React.FC<{
  to: string;
  title: string;
  value: string;
  label: string;
  icon: React.ElementType;
  className?: string;
}> = ({ to, title, value, label, icon: Icon, className = '' }) => (
  <Link
    to={to}
    className={`group block rounded-2xl border border-blue-200/18 bg-slate-950/35 p-4 shadow-[0_0_40px_-16px_rgba(59,130,246,0.8)] backdrop-blur-xl transition hover:-translate-y-1 hover:border-blue-300/50 hover:bg-blue-500/10 ${className}`}
  >
    <div className="flex items-center justify-between gap-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-100/72">{title}</p>
      <Icon className="h-5 w-5 text-blue-200 transition group-hover:scale-110" />
    </div>
    <div className="mt-3 text-3xl font-black text-white drop-shadow-[0_0_16px_rgba(147,197,253,0.45)]">{value}</div>
    <div className="mt-1 text-xs uppercase tracking-[0.16em] text-blue-100/58">{label}</div>
    <div className="mt-4 h-16 overflow-hidden rounded-xl border border-blue-200/10 bg-blue-950/35 p-2">
      <div className="grid h-full grid-cols-8 items-end gap-1">
        {Array.from({ length: 16 }).map((_, index) => (
          <span
            key={index}
            className="rounded-t bg-blue-300/55 shadow-[0_0_10px_rgba(147,197,253,0.65)]"
            style={{ height: `${22 + ((index * 17) % 62)}%` }}
          />
        ))}
      </div>
    </div>
  </Link>
);

const Hero: React.FC = () => {
  const telemetry = useHomepageTelemetry();

  return (
    <section
      aria-label="D3VONN.IO — AI Business Operating System"
      className="relative isolate flex min-h-[100svh] items-center overflow-hidden"
    >
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#073878] via-[#052f70] to-[#021b48]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_28%,rgba(0,162,255,0.34),transparent_36%),radial-gradient(circle_at_50%_54%,rgba(11,111,225,0.26),transparent_42%),radial-gradient(circle_at_18%_85%,rgba(103,196,255,0.12),transparent_38%)]" />
      <div className="absolute inset-0 -z-10 opacity-20 bg-[linear-gradient(rgba(113,191,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(113,191,255,0.06)_1px,transparent_1px)] bg-[size:72px_72px]" />
      <BinaryRain />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#073878]/70 via-transparent to-[#031f4f]/95" />

      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[52%] items-center justify-center pr-6 lg:flex xl:w-[50%]">
        <HeroLogoMark />
        <div className="absolute inset-0 bg-gradient-to-r from-[#073878] via-[#073878]/10 to-transparent" />
      </div>

      <div className="container relative mx-auto px-6 py-24 lg:py-32">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(440px,1.05fr)]">
          <div className="max-w-3xl animate-[fadeInUp_0.6s_ease-out_both]">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/35 bg-blue-500/10 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-blue-100 shadow-[0_0_30px_rgba(56,136,255,0.2)] backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-blue-200 shadow-[0_0_14px_rgba(147,197,253,0.9)] animate-pulse" />
              The AI Business Operating System
            </div>

            <div className="mt-8 lg:hidden">
              <HeroLogoMark />
            </div>

            <h1 className="mt-8 text-4xl font-black tracking-tight text-white drop-shadow-[0_0_28px_rgba(147,197,253,0.35)] sm:text-6xl lg:text-7xl">
              Bring your AI workforce alive.
            </h1>

            <p className="mt-6 max-w-2xl text-xl font-semibold text-blue-50/95 sm:text-2xl">
              D3VONN.IO turns business goals into supervised agent execution — AI workforce, swarm intelligence, knowledge graph, marketplace, automation, brand marketing, and AI movie production.
            </p>
            <p className="mt-4 max-w-xl text-base text-blue-100/76">
              One operating system for autonomous business work: Hermes orchestrates, agents execute, and you stay in control.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <SmartLaunchLink
                authedTo="/app"
                className="group inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200/40 bg-blue-600/80 px-7 py-4 font-semibold text-white shadow-[0_0_34px_rgba(56,136,255,0.48)] transition hover:scale-[1.02] hover:bg-blue-500 hover:shadow-[0_0_55px_rgba(56,136,255,0.68)]"
              >
                Launch Command Center
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </SmartLaunchLink>
              <Link
                to="/marketplace"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-100/25 bg-blue-300/10 px-7 py-4 font-semibold text-blue-50 backdrop-blur transition hover:border-blue-200/50 hover:bg-blue-300/15"
              >
                <Play className="h-4 w-4" />
                Explore Marketplace
              </Link>
            </div>

            <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3 text-center sm:text-left">
              {[
                [telemetry.activeAgents, 'active agents'],
                [telemetry.workflowsToday, 'workflows today'],
                [telemetry.systemStatus, 'system status'],
              ].map(([value, label]) => (
                <div key={label} className="rounded-xl border border-blue-200/15 bg-blue-300/10 px-3 py-3 backdrop-blur">
                  <div className="text-lg font-black text-white">{value}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-blue-100/60">{label}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3 text-xs text-blue-100/68">
              <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-blue-200" />Secure by design</span>
              <span className="hidden h-1 w-1 rounded-full bg-blue-100/35 sm:inline-block" />
              <span>Observable agent runs</span>
              <span className="hidden h-1 w-1 rounded-full bg-blue-100/35 sm:inline-block" />
              <span>Enterprise pilot ready</span>
            </div>
          </div>

          <div className="relative hidden lg:block">
            <div className="absolute inset-8 rounded-full bg-blue-400/20 blur-3xl" />
            <div className="relative grid grid-cols-2 gap-4 xl:grid-cols-3">
              <PanelLink to="/agents" title="AI Workforce" value={telemetry.activeAgents} label="agents online" icon={Users} />
              <PanelLink to="/workflows" title="Automation" value={telemetry.workflowsToday} label="runs today" icon={Workflow} />
              <PanelLink to="/dkos-ingestion" title="Knowledge Graph" value={telemetry.knowledgeNodes} label="indexed nodes" icon={Network} />
              <PanelLink to="/marketplace" title="Marketplace" value="Live" label="agents & tools" icon={ShoppingCart} />
              <PanelLink to="/film" title="AI Movie Studio" value="Studio" label="video engine" icon={Clapperboard} />
              <PanelLink to="/security/command-center" title="Security" value={telemetry.hermesQueue} label="Hermes queue" icon={Shield} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const TrustStrip: React.FC = () => (
  <section className="relative border-y border-blue-200/12 bg-[#031f4f]/90 py-6">
    <div className="container mx-auto grid gap-3 px-6 text-center text-xs uppercase tracking-[0.18em] text-blue-100/55 sm:grid-cols-4">
      <span>Hermes orchestration</span>
      <span>RAG knowledge vault</span>
      <span>Workflow supervision</span>
      <span>Security-first roadmap</span>
    </div>
  </section>
);

const howItWorksSteps = [
  { step: '01', title: 'Describe the goal', desc: 'Start with a business outcome: launch a campaign, prepare a brief, automate a workflow, or analyze an opportunity.' },
  { step: '02', title: 'Hermes plans the work', desc: 'Hermes decomposes the objective into tasks, dependencies, tools, checkpoints, and accountable next actions.' },
  { step: '03', title: 'Agents execute', desc: 'Specialized agents coordinate across strategy, operations, creation, research, and workflow automation.' },
  { step: '04', title: 'You govern the run', desc: 'Track status, approve critical steps, inspect outputs, and redirect the AI workforce from the Command Center.' },
];

const HowItWorks: React.FC = () => (
  <section className="relative bg-[#031f4f] py-20 scroll-mt-24">
    <div className="container mx-auto px-6">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">How It Works</p>
        <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
          From idea to execution in <span className="text-blue-300">one command layer</span>
        </h2>
        <p className="mt-4 text-base text-blue-100/72">
          D3VONN.IO makes the AI operating system understandable: intent enters, Hermes orchestrates, agents execute, and the human stays in control.
        </p>
      </div>
      <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {howItWorksSteps.map((s) => (
          <GlassCard key={s.step} className="h-full text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-blue-300/35 bg-blue-500/20 text-lg font-black text-blue-200">
              {s.step}
            </div>
            <h3 className="mt-5 text-lg font-bold text-white">{s.title}</h3>
            <p className="mt-2 text-sm text-blue-100/68">{s.desc}</p>
          </GlassCard>
        ))}
      </div>
    </div>
  </section>
);

const capabilities = [
  { icon: Settings, title: 'AI Workforce', desc: 'Specialized agents', to: '/agents' },
  { icon: Database, title: 'Knowledge Graph', desc: 'RAG context layer', to: '/dkos-ingestion' },
  { icon: Workflow, title: 'Automation Engine', desc: 'Repeatable execution', to: '/workflows' },
  { icon: Play, title: 'AI Movie Studio', desc: 'Video + voice creation', to: '/film' },
  { icon: Lightbulb, title: 'Brand Marketing', desc: 'Campaign intelligence', to: '/solutions' },
  { icon: Shield, title: 'Marketplace + Security', desc: 'Deploy with control', to: '/security/command-center' },
];

const CapabilitiesStrip: React.FC = () => (
  <section className="relative border-y border-blue-200/12 bg-[#052f70]/85 py-8">
    <div className="container mx-auto px-6">
      <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-6">
        {capabilities.map((cap) => (
          <Link key={cap.title} to={cap.to} className="group flex flex-col items-center gap-2 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-300/30 bg-blue-500/18 transition group-hover:scale-110 group-hover:border-blue-200/60">
              <cap.icon className="h-5 w-5 text-blue-200" />
            </div>
            <h3 className="text-xs font-semibold text-white">{cap.title}</h3>
            <p className="text-[10px] text-blue-100/58">{cap.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  </section>
);

const workforceAgents = [
  ['Hermes', 'Canonical orchestrator', 'Online'],
  ['Scout', 'Opportunity intelligence', 'Ready'],
  ['Builder', 'Product implementation', 'Ready'],
  ['Security', 'SOC response layer', 'Watching'],
  ['Research', 'Deep-dive analysis', 'Ready'],
  ['Finance', 'Deal and portfolio logic', 'Standby'],
  ['Marketing', 'Brand growth engine', 'Ready'],
  ['Compliance', 'Policy and risk review', 'Review'],
  ['Video', 'AI movie studio agent', 'Ready'],
  ['Voice', 'Voice AI interface', 'Ready'],
];

const WorkforceSection: React.FC = () => (
  <section className="relative bg-[#021b48] py-24">
    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.45),transparent_35%)]" />
    <div className="container relative mx-auto px-6">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">Meet Your AI Workforce</p>
        <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">Specialized agents working under Hermes control</h2>
        <p className="mt-4 text-blue-100/70">Each card is designed to become a live operational surface with status, queue depth, last run, and governance controls.</p>
      </div>
      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {workforceAgents.map(([name, role, status]) => (
          <GlassCard key={name} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-300/30 bg-blue-500/15">
                <Bot className="h-5 w-5 text-blue-200" />
              </div>
              <span className="rounded-full border border-blue-200/20 bg-blue-300/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-blue-100/65">{status}</span>
            </div>
            <h3 className="mt-5 text-lg font-bold text-white">{name}</h3>
            <p className="mt-2 text-sm text-blue-100/65">{role}</p>
          </GlassCard>
        ))}
      </div>
    </div>
  </section>
);

const architectureFlow = [
  ['Users', Users],
  ['Gateway', RadioTower],
  ['Hermes Orchestrator', Cpu],
  ['Knowledge Graph', Network],
  ['Memory + RAG', BookOpen],
  ['Agent Workforce', Bot],
  ['Workflow Engine', Workflow],
  ['Marketplace', ShoppingCart],
  ['Analytics', LineChart],
];

const ArchitectureSection: React.FC = () => (
  <section id="platform" className="relative bg-[#031f4f] py-24 scroll-mt-24">
    <div className="container mx-auto px-6">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">Platform Architecture</p>
        <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">One pipeline from intent to governed execution</h2>
      </div>
      <div className="mt-14 grid gap-4 md:grid-cols-3 lg:grid-cols-9">
        {architectureFlow.map(([label, Icon], index) => (
          <div key={String(label)} className="relative">
            <div className="rounded-2xl border border-blue-200/15 bg-blue-400/[0.04] p-4 text-center backdrop-blur">
              {React.createElement(Icon as React.ElementType, { className: 'mx-auto h-6 w-6 text-blue-200' })}
              <p className="mt-3 text-xs font-semibold text-white">{label}</p>
            </div>
            {index < architectureFlow.length - 1 && (
              <div className="absolute right-[-14px] top-1/2 hidden h-px w-7 bg-blue-300/35 lg:block" />
            )}
          </div>
        ))}
      </div>
    </div>
  </section>
);

const trustControls = [
  ['Audit logs', Activity],
  ['Role-based access', Lock],
  ['SOC dashboard', ShieldCheck],
  ['API + SDK layer', Code2],
  ['Cloud / VPS / Kubernetes', Cloud],
  ['Observability', LineChart],
  ['Encryption roadmap', Shield],
  ['Human approvals', Users],
];

const TrustControlsSection: React.FC = () => (
  <section className="relative bg-[#052f70]/90 py-20">
    <div className="container mx-auto px-6">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-200">Enterprise Trust Layer</p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">Built to look serious because the system is serious.</h2>
          <p className="mt-5 text-blue-100/70">The homepage now points buyers toward the controls that matter: security, auditability, deployment options, observability, and governed automation.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {trustControls.map(([label, Icon]) => (
            <div key={String(label)} className="flex items-center gap-3 rounded-2xl border border-blue-200/15 bg-slate-950/25 p-4 backdrop-blur">
              {React.createElement(Icon as React.ElementType, { className: 'h-5 w-5 text-blue-200' })}
              <span className="text-sm font-semibold text-blue-50">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

const BelowFoldSections = lazy(() => import('@/components/index/BelowFoldSections'));

const Index: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  const title = 'D3VONN.IO — AI Business Operating System';
  const description =
    'D3VONN.IO is an AI Business Operating System for AI workforce orchestration, swarm intelligence, knowledge graphs, workflow automation, marketplace agents, brand marketing, AI movie production, and enterprise security.';
  const url = 'https://d3vonn.io/';

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-[#031f4f] text-white">
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

      <motion.div
        className="fixed left-0 right-0 top-0 z-50 h-1 origin-left bg-blue-300 shadow-[0_0_12px_rgba(147,197,253,0.85)]"
        style={{ scaleX }}
      />

      <main id="main-content">
        <Hero />
        <TrustStrip />
        <HowItWorks />
        <CapabilitiesStrip />
        <WorkforceSection />
        <ArchitectureSection />
        <KnowledgeGraphPreview />
        <TrustControlsSection />

        <Suspense fallback={<div className="bg-[#031f4f] py-24 text-center text-sm text-blue-100/45">Loading...</div>}>
          <BelowFoldSections />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
