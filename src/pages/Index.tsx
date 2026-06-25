import React from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  ArrowRight, ArrowLeft, Bot, ShieldCheck, Network, Zap, Cpu, Database,
  Workflow, Lock, Activity, Globe, Layers, Rocket, Brain, KeySquare,
  Settings, Eye, BarChart3, Shield, Lightbulb, ChevronRight, Play,
  Infinity, Key, Clock, Earth,
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
/*  1. Hero Section — matches mockup with hero image on right                 */
/* -------------------------------------------------------------------------- */

const Hero: React.FC = () => (
  <section
    aria-label="D3VONN.IO — The World's First AI Business Operating System"
    className="relative isolate overflow-hidden min-h-[100svh] flex items-center"
  >
    {/* Background */}
    <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#020817] via-[#0a1628] to-[#000814]" />
    <div className="absolute inset-0 -z-10 opacity-10 bg-[linear-gradient(rgba(56,136,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(56,136,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />

    {/* Hero image on the right */}
    <div className="absolute right-0 top-0 bottom-0 w-[55%] hidden lg:block">
      <img
        src={heroAsset.url}
        alt="D3VONN.IO AI Operating System - futuristic command interface"
        className="h-full w-full object-cover object-left opacity-90"
        draggable={false}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#020817] via-[#020817]/60 to-transparent" />
    </div>

    <div className="container relative mx-auto px-6 py-24 lg:py-32">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="max-w-2xl"
      >
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
      </motion.div>
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
        {howItWorksSteps.map((s, i) => (
          <motion.div
            key={s.step}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
          >
            <GlassCard className="h-full text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-400 font-black text-lg">
                {s.step}
              </div>
              <h3 className="mt-5 text-lg font-bold text-white">{s.title}</h3>
              <p className="mt-2 text-sm text-white/70">{s.desc}</p>
            </GlassCard>
          </motion.div>
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
/*  3. Platform section — "One Platform. Infinite Possibilities."             */
/* -------------------------------------------------------------------------- */

const agentCards = [
  { name: 'Hermes', role: 'AI Executive Assistant', desc: 'Your always-on assistant that thinks, acts, and executes.' },
  { name: 'Strategist', role: 'AI Business Strategist', desc: 'Market intelligence, strategy generation, and competitive advantage.' },
  { name: 'Operator', role: 'AI Operations Agent', desc: 'Automate workflows, manage systems, and optimize operations.' },
  { name: 'Creator', role: 'AI Content Studio', desc: 'Create content, visuals, code, and campaigns instantly.' },
];

const PlatformSection: React.FC = () => (
  <section id="platform" className="relative py-24 scroll-mt-24">
    <div className="container mx-auto px-6">
      <div className="grid lg:grid-cols-[1fr_2fr] gap-12 items-start">
        {/* Left text */}
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-blue-400 font-semibold">The D3VONN Platform</p>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight">
            One Platform.<br />
            <span className="text-white/90">Infinite Possibilities.</span>
          </h2>
          <p className="mt-4 text-base text-white/70">
            D3VONN.IO is more than software.<br />
            It's your new operating system<br />
            for the AI era.
          </p>
          <Link
            to="/agents"
            className="mt-8 inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
          >
            See All Agents <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Agent cards carousel */}
        <div className="relative">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {agentCards.map((agent) => (
              <GlassCard key={agent.name} className="group h-full bg-gradient-to-b from-white/[0.04] to-transparent">
                <div className="h-32 rounded-xl bg-gradient-to-br from-blue-950/40 to-slate-900/40 border border-white/5 mb-4 flex items-center justify-center">
                  <Bot className="h-12 w-12 text-blue-400/60" />
                </div>
                <h3 className="text-base font-bold text-blue-400">{agent.name}</h3>
                <p className="text-[10px] uppercase tracking-wider text-white/50 mt-1">{agent.role}</p>
                <p className="mt-3 text-xs text-white/70">{agent.desc}</p>
                <div className="mt-4 flex justify-end">
                  <ChevronRight className="h-4 w-4 text-white/40 group-hover:text-blue-400 transition-colors" />
                </div>
              </GlassCard>
            ))}
          </div>
          {/* Carousel arrows */}
          <div className="absolute -top-12 right-0 flex gap-2">
            <button className="h-8 w-8 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition" aria-label="Previous agents">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button className="h-8 w-8 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition" aria-label="Next agents">
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
);

/* -------------------------------------------------------------------------- */
/*  4. Stats bar                                                              */
/* -------------------------------------------------------------------------- */

const stats = [
  { value: '99.9%', label: 'System Uptime' },
  { icon: Infinity, value: '∞', label: 'Scalable Agents' },
  { value: '256-bit', label: 'End-to-End Encryption' },
  { value: '24/7', label: 'Autonomous Operations' },
  { value: 'Global', label: 'Secure Infrastructure' },
];

const StatsBar: React.FC = () => (
  <section className="relative border-y border-white/10 bg-[#0a1220]/60 py-10">
    <div className="container mx-auto px-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6 text-center">
        {stats.map((stat) => (
          <div key={stat.label}>
            <div className="text-2xl sm:text-3xl font-black text-white">{stat.value}</div>
            <p className="mt-1 text-xs text-white/50">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* -------------------------------------------------------------------------- */
/*  5. Feature grid — Everything an AI Business needs                         */
/* -------------------------------------------------------------------------- */

const features = [
  { icon: Brain,    title: 'Autonomous Agents',     desc: 'Goal-driven AI workers that plan, execute, and self-correct across tools.' },
  { icon: Workflow, title: 'Workflow Engine',       desc: 'Visual DAG orchestration with 1100+ templates and n8n integration.' },
  { icon: Database, title: 'Knowledge Vault',       desc: 'Encrypted memory with RAG, secured by row-level policies.' },
  { icon: Cpu,      title: 'Hermes Intelligence',   desc: 'Real-time mesh fabric for cross-agent coordination and signals.' },
  { icon: Lock,     title: 'Enterprise Security',   desc: 'Defense-in-depth: RLS, safe views, server-side encryption.' },
  { icon: Activity, title: 'Live Observability',    desc: 'Streamed runs, audit logs, and health metrics — end to end.' },
];

const FeatureGrid: React.FC = () => (
  <section className="relative py-24 scroll-mt-24">
    <div className="container mx-auto px-6">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-blue-400 font-semibold">The Platform</p>
        <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
          Everything an <span className="text-blue-400">AI Business</span> needs
        </h2>
        <p className="mt-4 text-base text-white/70">
          One operating system for agents, workflows, memory, and signals — built for the autonomous enterprise.
        </p>
      </div>
      <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
          >
            <GlassCard className="group h-full">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-950/60 border border-blue-500/20 text-blue-400">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm text-white/70">{f.desc}</p>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

/* -------------------------------------------------------------------------- */
/*  6. Command Center preview                                                 */
/* -------------------------------------------------------------------------- */

const CommandCenterPreview: React.FC = () => (
  <section id="command-center" className="relative py-24 scroll-mt-24">
    <div className="container mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-blue-400 font-semibold">Command Center</p>
        <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
          One console. <span className="text-blue-400">Total control.</span>
        </h2>
        <p className="mt-4 text-base text-white/70">
          Supervise every agent, workflow, and signal in real time — with surgical precision.
        </p>
        <ul className="mt-8 space-y-4 text-sm text-white/80">
          {[
            'Live agent supervision with intervention controls',
            'Cross-mesh telemetry from Hermes Intelligence',
            'Hot-swap models, prompts, and tools mid-run',
            'Encrypted audit trails for every decision',
          ].map((line) => (
            <li key={line} className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(56,136,255,0.8)]" />
              {line}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex gap-3">
          <Link
            to="/occ"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_0_30px_rgba(56,136,255,0.4)] hover:scale-[1.02] transition"
          >
            Open Command Center <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/command-center"
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
          >
            Tour the console
          </Link>
        </div>
      </div>

      {/* Faux dashboard panel */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
      >
        <GlassCard className="relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
            </div>
            <span className="text-[10px] uppercase tracking-widest text-white/50">d3vonn / occ</span>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              { k: 'Agents online',   v: '24' },
              { k: 'Tasks / min',     v: '318' },
              { k: 'Mesh latency',    v: '42ms' },
            ].map((s) => (
              <div key={s.k} className="rounded-lg border border-white/10 bg-black/40 p-3">
                <div className="text-xl font-bold text-blue-400">{s.v}</div>
                <div className="mt-1 text-[10px] uppercase tracking-widest text-white/50">{s.k}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-2">
            {[
              ['Atlas Researcher', 'Synthesizing', 72],
              ['Helios Sales',     'Dispatching',  46],
              ['Vault Sentinel',   'Scanning',     91],
              ['Forge Engineer',   'Deploying',    33],
            ].map(([name, status, pct]) => (
              <div key={name as string} className="rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">{name}</span>
                  <span className="text-white/60">{status}</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500 shadow-[0_0_10px_rgba(56,136,255,0.8)]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </motion.div>
    </div>
  </section>
);

/* -------------------------------------------------------------------------- */
/*  7. Pricing                                                                */
/* -------------------------------------------------------------------------- */

const plans = [
  {
    name: 'Starter',
    price: '$0',
    period: '/forever',
    desc: 'For builders exploring autonomous workflows.',
    features: ['3 active agents', 'Community marketplace', 'Basic observability'],
    cta: 'Start free',
    featured: false,
  },
  {
    name: 'Operator',
    price: '$49',
    period: '/month',
    desc: 'For teams running an AI workforce in production.',
    features: ['Unlimited agents', 'Hermes mesh + RAG vault', 'Priority support'],
    cta: 'Launch Operator',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    desc: 'Sovereign deployments with bespoke integrations.',
    features: ['On-prem / VPC', 'Custom SSO + RBAC', 'Dedicated engineering'],
    cta: 'Talk to us',
    featured: false,
  },
];

const Pricing: React.FC = () => (
  <section id="pricing" className="relative py-24 scroll-mt-24">
    <div className="container mx-auto px-6">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-blue-400 font-semibold">Pricing</p>
        <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
          Built for <span className="text-blue-400">every scale</span> of autonomy
        </h2>
        <p className="mt-4 text-base text-white/70">
          Transparent tiers. Predictable economics. No surprise tokens.
        </p>
      </div>
      <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((p) => (
          <GlassCard
            key={p.name}
            className={
              'flex flex-col h-full ' +
              (p.featured
                ? 'border-blue-500/50 shadow-[0_0_60px_-8px_rgba(56,136,255,0.5)]'
                : '')
            }
          >
            {p.featured && (
              <div className="absolute -top-3 left-6 rounded-full bg-blue-600 px-3 py-1 text-[10px] uppercase tracking-widest text-white shadow-[0_0_20px_rgba(56,136,255,0.6)]">
                Most popular
              </div>
            )}
            <h3 className="text-xl font-semibold text-white">{p.name}</h3>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-black text-white">{p.price}</span>
              <span className="text-sm text-white/60">{p.period}</span>
            </div>
            <p className="mt-3 text-sm text-white/70">{p.desc}</p>
            <ul className="mt-5 space-y-2 text-sm text-white/80 flex-1">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(56,136,255,0.8)]" />
                  {f}
                </li>
              ))}
            </ul>
            {p.name === 'Enterprise' ? (
              <Link
                to="/contact"
                className={
                  'mt-6 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition ' +
                  (p.featured
                    ? 'bg-blue-600 text-white shadow-[0_0_30px_rgba(56,136,255,0.4)] hover:scale-[1.02]'
                    : 'border border-white/20 bg-white/5 text-white hover:bg-white/10')
                }
              >
                {p.cta} <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <SmartLaunchLink
                authedTo="/app"
                className={
                  'mt-6 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition ' +
                  (p.featured
                    ? 'bg-blue-600 text-white shadow-[0_0_30px_rgba(56,136,255,0.4)] hover:scale-[1.02]'
                    : 'border border-white/20 bg-white/5 text-white hover:bg-white/10')
                }
              >
                {p.cta} <ArrowRight className="h-4 w-4" />
              </SmartLaunchLink>
            )}
          </GlassCard>
        ))}
      </div>
    </div>
  </section>
);

/* -------------------------------------------------------------------------- */
/*  8. Final CTA                                                              */
/* -------------------------------------------------------------------------- */

const FinalCTA: React.FC = () => (
  <section className="relative py-24">
    <div className="container mx-auto px-6">
      <GlassCard className="text-center py-14">
        <p className="text-xs uppercase tracking-[0.2em] text-blue-400 font-semibold">Ready when you are</p>
        <h2 className="mt-5 text-3xl sm:text-5xl font-black text-white">
          Launch your <span className="text-blue-400">autonomous business</span>.
        </h2>
        <p className="mt-4 max-w-xl mx-auto text-white/70">
          The future of work isn't headcount — it's orchestration. Start with D3VONN.IO today.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <SmartLaunchLink
            authedTo="/app"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 py-4 font-semibold text-white shadow-[0_0_40px_rgba(56,136,255,0.4)] hover:scale-[1.02] transition"
          >
            Launch D3VONN <ArrowRight className="h-4 w-4" />
          </SmartLaunchLink>
          <Link
            to="/platform"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-7 py-4 font-semibold text-white hover:bg-white/10 transition"
          >
            Explore Platform
          </Link>
        </div>
      </GlassCard>
    </div>
  </section>
);

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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen flex flex-col bg-[#020817] text-white overflow-hidden"
    >
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://d3vonn.io/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content="https://d3vonn.io/og-image.png" />
      </Helmet>

      {/* Progress bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-blue-500 z-50 origin-left shadow-[0_0_12px_rgba(56,136,255,0.7)]"
        style={{ scaleX }}
      />

      <Navbar transparent />

      <main id="main-content">
        <Hero />
        <HowItWorks />
        <CapabilitiesStrip />
        <PlatformSection />
        <StatsBar />
        <FeatureGrid />
        <CommandCenterPreview />
        <Pricing />
        <FinalCTA />
      </main>

      <Footer />
    </motion.div>
  );
};

export default Index;
