import React, { lazy, Suspense } from 'react';
import { useScroll, useSpring, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  ArrowRight, ShieldCheck, Database, Workflow, Settings, Shield, Lightbulb, Play,
} from 'lucide-react';
import Footer from '@/components/Footer';
import SmartLaunchLink from '@/components/SmartLaunchLink';

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
  <div className="relative mx-auto w-[90vw] max-w-[820px] overflow-visible py-1 sm:w-[86vw] lg:w-full lg:max-w-[760px] xl:max-w-[820px]">
    <div className="absolute inset-x-[-10%] top-1/2 h-80 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(0,168,255,0.48),rgba(0,84,180,0.24)_45%,rgba(6,38,92,0.1)_66%,transparent_82%)] blur-2xl" />
    <div className="absolute inset-x-[-8%] top-[48%] h-64 -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,transparent,rgba(29,142,255,0.26),transparent)] blur-xl" />
    <img
      src="/og-image.png"
      alt="D3VONN.IO logo"
      className="relative z-10 w-full -rotate-[2deg] scale-[1.06] object-contain object-center opacity-[0.96] mix-blend-screen drop-shadow-[0_0_52px_rgba(0,163,255,0.68)] lg:scale-[1.02]"
      style={{
        WebkitMaskImage: 'radial-gradient(ellipse at center, #000 0%, #000 56%, rgba(0,0,0,.72) 73%, transparent 100%)',
        maskImage: 'radial-gradient(ellipse at center, #000 0%, #000 56%, rgba(0,0,0,.72) 73%, transparent 100%)',
      }}
      draggable={false}
      loading="eager"
      decoding="async"
    />
    <div className="pointer-events-none absolute inset-x-[-8%] top-0 h-28 bg-gradient-to-b from-[#073878]/65 via-[#073878]/20 to-transparent" />
    <div className="pointer-events-none absolute inset-x-[-8%] bottom-0 h-36 bg-gradient-to-t from-[#031f4f] via-[#031f4f]/45 to-transparent" />
  </div>
);

const Hero: React.FC = () => (
  <section
    aria-label="D3VONN.IO — AI Business Operating System"
    className="relative isolate flex min-h-[100svh] items-center overflow-hidden"
  >
    <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#073878] via-[#052f70] to-[#021b48]" />
    <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_28%,rgba(0,162,255,0.34),transparent_36%),radial-gradient(circle_at_50%_54%,rgba(11,111,225,0.26),transparent_42%),radial-gradient(circle_at_18%_85%,rgba(103,196,255,0.12),transparent_38%)]" />
    <div className="absolute inset-0 -z-10 opacity-20 bg-[linear-gradient(rgba(113,191,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(113,191,255,0.06)_1px,transparent_1px)] bg-[size:72px_72px]" />
    <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#073878]/70 via-transparent to-[#031f4f]/95" />

    <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[50%] items-center justify-center pr-6 lg:flex xl:w-[48%]">
      <HeroLogoMark />
      <div className="absolute inset-0 bg-gradient-to-r from-[#073878] via-[#073878]/10 to-transparent" />
    </div>

    <div className="container relative mx-auto px-6 py-24 lg:py-32">
      <div className="max-w-3xl animate-[fadeInUp_0.6s_ease-out_both]">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/35 bg-blue-500/10 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-blue-100 shadow-[0_0_30px_rgba(56,136,255,0.2)] backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-blue-200 shadow-[0_0_14px_rgba(147,197,253,0.9)] animate-pulse" />
          AI Workforce Operating Layer
        </div>

        <div className="mt-8 lg:hidden">
          <HeroLogoMark />
        </div>

        <h1 className="mt-8 text-4xl font-black tracking-tight text-white drop-shadow-[0_0_28px_rgba(147,197,253,0.35)] sm:text-6xl lg:text-7xl">
          Build your AI workforce in minutes.
        </h1>

        <p className="mt-6 max-w-2xl text-xl font-semibold text-blue-50/95 sm:text-2xl">
          D3VONN.IO turns business goals into supervised agent execution — planning, workflows, memory, approvals, and command-center visibility.
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
            to="/agents"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-100/25 bg-blue-300/10 px-7 py-4 font-semibold text-blue-50 backdrop-blur transition hover:border-blue-200/50 hover:bg-blue-300/15"
          >
            <Play className="h-4 w-4" />
            Explore Agents
          </Link>
        </div>

        <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3 text-center sm:text-left">
          {[
            ['573+', 'tests passing'],
            ['41/41', 'CI checks'],
            ['Live', 'Railway + Vercel'],
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
    </div>
  </section>
);

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
  { icon: Settings, title: 'Multi-Agent Orchestration', desc: 'Coordinate AI workers' },
  { icon: Database, title: 'Memory & Knowledge', desc: 'RAG context layer' },
  { icon: Workflow, title: 'Workflow Engine', desc: 'Repeatable execution' },
  { icon: Shield, title: 'Governed Autonomy', desc: 'Human control points' },
  { icon: Lightbulb, title: 'Business Intelligence', desc: 'Decision-ready outputs' },
];

const CapabilitiesStrip: React.FC = () => (
  <section className="relative border-y border-blue-200/12 bg-[#052f70]/85 py-8">
    <div className="container mx-auto px-6">
      <div className="grid grid-cols-2 gap-6 md:grid-cols-5">
        {capabilities.map((cap) => (
          <div key={cap.title} className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-300/30 bg-blue-500/18">
              <cap.icon className="h-5 w-5 text-blue-200" />
            </div>
            <h3 className="text-xs font-semibold text-white">{cap.title}</h3>
            <p className="text-[10px] text-blue-100/58">{cap.desc}</p>
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
        <link rel="preload" as="image" href="/og-image.png" />
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

        <Suspense fallback={<div className="bg-[#031f4f] py-24 text-center text-sm text-blue-100/45">Loading...</div>}>
          <BelowFoldSections />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
