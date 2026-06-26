import React, { lazy, Suspense } from 'react';
import { useScroll, useSpring, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  ArrowRight, ArrowLeft, Bot, ShieldCheck, Network, Zap, Cpu, Database,
  Workflow, Lock, Activity, Globe, Layers, Rocket, Brain, KeySquare,
  Settings, Eye, BarChart3, Shield, Lightbulb, ChevronRight, Play,
  Key, Clock, Earth,
} from 'lucide-react';
import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';
import SmartLaunchLink from '@/components/SmartLaunchLink';
import heroAsset from '@/assets/d3vonn-home-hero.png.asset.json';

/* -------------------------------------------------------------------------- */
/*  Shared atoms                                                              */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*  1. Hero Section — minimal animation for fast FCP/LCP                      */
/* -------------------------------------------------------------------------- */

const Hero: React.FC = () => (
  <section
    aria-label="D3VONN.IO — The World's First AI Business Operating System"
    className="relative isolate overflow-hidden min-h-[100svh] flex items-center"
  >
    {/* Background */}
    <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#020817] via-[#0a1628] to-[#000814]" />
    <div className="absolute inset-0 -z-10 opacity-10 bg-[linear-gradient(rgba(56,136,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(56,136,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />

    {/* Hero image on the right — uses fetchpriority for LCP */}
    <div className="absolute right-0 top-0 bottom-0 w-[55%] hidden lg:block">
      <img
        src={heroAsset.url}
        alt="D3VONN.IO AI Operating System - futuristic command interface"
        className="h-full w-full object-cover object-left opacity-90"
        draggable={false}
        fetchPriority="high"
        decoding="async"
        width={960}
        height={1080}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#020817] via-[#020817]/60 to-transparent" />
    </div>

    <div className="container relative mx-auto px-6 py-24 lg:py-32">
      {/* No framer-motion wrapper here — CSS animation is lighter for FCP */}
      <div className="max-w-2xl animate-[fadeInUp_0.6s_ease-out_both]">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-950/40 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-blue-300">
          <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
          AI Workforce. Limitless Potential.
        </div>

        {/* Headline */}
        <h1 className="mt-8 font-black tracking-tight text-white">
          <span className="block text-4xl sm:text-5xl lg:text-6xl uppercase">Welcome to</span>
          <span className="block text-5xl sm:text-7xl lg:text-8xl uppercase mt-2">
            D3VONN<span className="text-blue-400">.io</span>
          </span>
        </h1>

        {/* Subheadline */}
        <p className="mt-6 text-xl sm:text-2xl font-semibold text-white/90">
          The World's First AI Business Operating System
        </p>
        <p className="mt-3 max-w-lg text-base text-white/70">
          Orchestrate your AI workforce. Automate everything.
          <br />Scale without limits.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <SmartLaunchLink
            authedTo="/app"
            className="group inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 py-4 font-semibold text-white shadow-[0_0_30px_rgba(56,136,255,0.4)] transition hover:bg-blue-500 hover:scale-[1.02] hover:shadow-[0_0_50px_rgba(56,136,255,0.6)]"
          >
            Launch D3VONN
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </SmartLaunchLink>
          <Link
            to="/platform"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-7 py-4 font-semibold text-white backdrop-blur transition hover:bg-white/10 hover:border-blue-400/40"
          >
            <Play className="h-4 w-4" />
            Explore Platform
          </Link>
        </div>

        {/* Trust badges */}
        <div className="mt-8 flex items-center gap-2 text-xs text-white/60">
          <ShieldCheck className="h-4 w-4 text-blue-400" />
          <span>Secure. Private. Built for the Future.</span>
        </div>
      </div>
    </div>
  </section>
);

/* -------------------------------------------------------------------------- */
/*  1b. How It Works — value proposition in 4 steps                           */
/* -------------------------------------------------------------------------- */

const howItWorksSteps = [
  { step: '01', title: 'Describe Your Goal', desc: 'Tell Hermes what you want to achieve in plain language — a campaign, a report, a workflow, anything.' },
  { step: '02', title: 'Hermes Creates a Plan', desc: 'Your AI executive assistant decomposes the goal into tasks, selects the right agents, and sequences execution.' },
  { step: '03', title: 'Agents Execute', desc: 'Specialized AI workers (Strategist, Operator, Creator) carry out each task autonomously and in parallel.' },
  { step: '04', title: 'Monitor & Iterate', desc: 'Watch progress in real time from the Command Center. Intervene, redirect, or approve — you stay in control.' },
];

const HowItWorks: React.FC = () => (
  <section className="relative py-20 scroll-mt-24">
    <div className="container mx-auto px-6">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-blue-400 font-semibold">How It Works</p>
        <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
          From idea to execution in <span className="text-blue-400">seconds</span>
        </h2>
        <p className="mt-4 text-base text-white/70">
          D3VONN.IO turns your business objectives into autonomous action — no code, no complexity.
        </p>
      </div>
      <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {howItWorksSteps.map((s) => (
          <GlassCard key={s.step} className="h-full text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-400 font-black text-lg">
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

/* -------------------------------------------------------------------------- */
/*  2. Capabilities strip                                                     */
/* -------------------------------------------------------------------------- */

const capabilities = [
  { icon: Settings, title: 'Multi-Agent Orchestration', desc: 'Deploy intelligent AI teams' },
  { icon: Database, title: 'Memory & Knowledge', desc: 'Persistent. Private. Powerful.' },
  { icon: Workflow, title: 'Automation at Scale', desc: 'Workflows that work for you' },
  { icon: Shield, title: 'Secure by Design', desc: 'Enterprise-grade security' },
  { icon: Lightbulb, title: 'Real-Time Intelligence', desc: 'Insights that drive impact' },
];

const CapabilitiesStrip: React.FC = () => (
  <section className="relative border-y border-white/10 bg-[#0a1220]/80 py-8">
    <div className="container mx-auto px-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
        {capabilities.map((cap) => (
          <div key={cap.title} className="flex flex-col items-center text-center gap-2">
            <div className="h-10 w-10 rounded-full bg-blue-950/60 border border-blue-500/20 flex items-center justify-center">
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

/* -------------------------------------------------------------------------- */
/*  Below-the-fold sections — lazy loaded to reduce initial JS parse time     */
/* -------------------------------------------------------------------------- */

const BelowFoldSections = lazy(() => import('@/components/index/BelowFoldSections'));

/* -------------------------------------------------------------------------- */
/*  Page shell                                                                */
/* -------------------------------------------------------------------------- */

const Index: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  const title = 'D3VONN.IO — AI Business Operating System';
  const description =
    'D3VONN.IO is the World\'s First AI Business Operating System — orchestrate your AI workforce, automate workflows, and command an autonomous enterprise from one console.';
  const url = 'https://d3vonn.io/';

  return (
    <div className="min-h-screen flex flex-col bg-[#020817] text-white overflow-hidden">
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
        {/* Preload hero image for faster LCP */}
        <link rel="preload" as="image" href={heroAsset.url} />
      </Helmet>

      {/* Progress bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-blue-500 z-50 origin-left shadow-[0_0_12px_rgba(56,136,255,0.7)]"
        style={{ scaleX }}
      />

      <Navbar transparent />

      <main id="main-content">
        {/* Above the fold — critical path, renders immediately */}
        <Hero />
        <HowItWorks />
        <CapabilitiesStrip />

        {/* Below the fold — lazy loaded, reduces initial JS by ~40% */}
        <Suspense fallback={
          <div className="py-24 text-center text-white/40 text-sm">Loading...</div>
        }>
          <BelowFoldSections />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
