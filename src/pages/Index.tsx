import React, { lazy, Suspense } from 'react';
import { useScroll, useSpring, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  ArrowRight, ShieldCheck, Database, Workflow, Settings, Shield, Lightbulb, Play,
} from 'lucide-react';
import Footer from '@/components/Footer';
import SmartLaunchLink from '@/components/SmartLaunchLink';
import heroAsset from '@/assets/d3vonn-home-hero.png.asset.json';

const GlassCard: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...rest
}) => (
  <div
    {...rest}
    className={
      'relative rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl ' +
      'shadow-[0_0_40px_-12px_rgba(56,136,255,0.25)] transition-all duration-300 ' +
      'hover:border-blue-500/40 hover:shadow-[0_0_60px_-8px_rgba(56,136,255,0.45)] hover:-translate-y-0.5 ' +
      className
    }
  >
    {children}
  </div>
);

const Hero: React.FC = () => (
  <section
    aria-label="D3VONN.IO — AI Business Operating System"
    className="relative isolate flex min-h-[100svh] items-center overflow-hidden"
  >
    <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#020817] via-[#0a1628] to-[#000814]" />
    <div className="absolute inset-0 -z-10 opacity-10 bg-[linear-gradient(rgba(56,136,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(56,136,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />

    <div className="absolute bottom-0 right-0 top-0 hidden w-[58%] lg:block">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_66%_42%,rgba(56,136,255,0.24),transparent_42%)]" />
      <img
        src={heroAsset.url}
        alt="D3VONN.IO metallic blue logo"
        className="relative z-0 h-full w-full object-contain object-center opacity-100 drop-shadow-[0_0_55px_rgba(56,136,255,0.38)]"
        draggable={false}
        fetchPriority="high"
        decoding="async"
        width={960}
        height={1080}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#020817] via-[#020817]/35 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/5 bg-gradient-to-l from-[#000814] to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-[#020817] to-transparent" />
    </div>

    <div className="container relative mx-auto px-6 py-24 lg:py-32">
      <div className="max-w-3xl animate-[fadeInUp_0.6s_ease-out_both]">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-950/40 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-blue-300">
          <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
          AI Workforce Operating Layer
        </div>

        <div className="mt-8 overflow-hidden rounded-3xl border border-blue-400/15 bg-[#020817] shadow-[0_0_60px_rgba(56,136,255,0.18)] lg:hidden">
          <img
            src={heroAsset.url}
            alt="D3VONN.IO logo"
            className="w-full object-contain opacity-100"
            draggable={false}
            decoding="async"
            width={960}
            height={640}
          />
        </div>

        <h1 className="mt-8 text-4xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl">
          Build your AI workforce in minutes.
        </h1>

        <p className="mt-6 max-w-2xl text-xl font-semibold text-white/90 sm:text-2xl">
          D3VONN.IO turns business goals into supervised agent execution — planning, workflows, memory, approvals, and command-center visibility.
        </p>
        <p className="mt-4 max-w-xl text-base text-white/70">
          One operating system for autonomous business work: Hermes orchestrates, agents execute, and you stay in control.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <SmartLaunchLink
            authedTo="/app"
            className="group inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 py-4 font-semibold text-white shadow-[0_0_30px_rgba(56,136,255,0.4)] transition hover:scale-[1.02] hover:bg-blue-500 hover:shadow-[0_0_50px_rgba(56,136,255,0.6)]"
          >
            Launch D3VONN
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </SmartLaunchLink>
          <Link
            to="/solutions"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-7 py-4 font-semibold text-white backdrop-blur transition hover:border-blue-400/40 hover:bg-white/10"
          >
            <Play className="h-4 w-4" />
            See Use Cases
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3 text-xs text-white/60">
          <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-blue-400" />Secure by design</span>
          <span className="hidden h-1 w-1 rounded-full bg-white/30 sm:inline-block" />
          <span>Observable agent runs</span>
          <span className="hidden h-1 w-1 rounded-full bg-white/30 sm:inline-block" />
          <span>Enterprise pilot ready</span>
        </div>
      </div>
    </div>
  </section>
);

const TrustStrip: React.FC = () => (
  <section className="relative border-y border-white/10 bg-[#07101f]/80 py-6">
    <div className="container mx-auto grid gap-3 px-6 text-center text-xs uppercase tracking-[0.18em] text-white/50 sm:grid-cols-4">
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
  <section className="relative py-20 scroll-mt-24">
    <div className="container mx-auto px-6">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">How It Works</p>
        <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
          From idea to execution in <span className="text-blue-400">one command layer</span>
        </h2>
        <p className="mt-4 text-base text-white/70">
          D3VONN.IO makes the AI operating system understandable: intent enters, Hermes orchestrates, agents execute, and the human stays in control.
        </p>
      </div>
      <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {howItWorksSteps.map((s) => (
          <GlassCard key={s.step} className="h-full text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-blue-500/30 bg-blue-600/20 text-lg font-black text-blue-400">
              {s.step}
            </div>
            <h3 className="mt-5 text-lg font-bold text-white">{s.title}</h3>
            <p className="mt-2 text-sm text-white/70">{s.desc}</p>
          </GlassCard>
        ))}
      </div>
    </div>
  </section>
);

const capabilities = [
  { icon: Settings, title: 'Multi-Agent Orchestration', desc: 'Coordinate AI workers' },
  { icon: Database, title: 'Memory & Knowledge', desc: 'RAG context layer' },
  { icon: Workflow, title: 'Workflow Engine', desc: 'Repeatable execution' },
  { icon: Shield, title: 'Governed Autonomy', desc: 'Human control points' },
  { icon: Lightbulb, title: 'Business Intelligence', desc: 'Decision-ready outputs' },
];

const CapabilitiesStrip: React.FC = () => (
  <section className="relative border-y border-white/10 bg-[#0a1220]/80 py-8">
    <div className="container mx-auto px-6">
      <div className="grid grid-cols-2 gap-6 md:grid-cols-5">
        {capabilities.map((cap) => (
          <div key={cap.title} className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-500/20 bg-blue-950/60">
              <cap.icon className="h-5 w-5 text-blue-400" />
            </div>
            <h3 className="text-xs font-semibold text-white">{cap.title}</h3>
            <p className="text-[10px] text-white/50">{cap.desc}</p>
          </div>
        ))}
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
    'D3VONN.IO is an AI Business Operating System that turns business goals into supervised agent execution with Hermes orchestration, workflows, memory, and command-center visibility.';
  const url = 'https://d3vonn.io/';

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-[#020817] text-white">
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
        <link rel="preload" as="image" href={heroAsset.url} />
      </Helmet>

      <motion.div
        className="fixed left-0 right-0 top-0 z-50 h-1 origin-left bg-blue-500 shadow-[0_0_12px_rgba(56,136,255,0.7)]"
        style={{ scaleX }}
      />

      <main id="main-content">
        <Hero />
        <TrustStrip />
        <HowItWorks />
        <CapabilitiesStrip />

        <Suspense fallback={<div className="py-24 text-center text-sm text-white/40">Loading...</div>}>
          <BelowFoldSections />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
