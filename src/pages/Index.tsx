import React from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  ArrowRight, Bot, ShieldCheck, Network, Zap, Sparkles, Cpu, Database,
  Workflow, Lock, Activity, Globe, Layers, Rocket, Brain, KeySquare,
} from 'lucide-react';
import Footer from '@/components/Footer';
import AuthNavButton from '@/components/AuthNavButton';

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
      'shadow-[0_0_40px_-12px_rgba(112,128,255,0.35)] transition-all duration-300 ' +
      'hover:border-primary/40 hover:shadow-[0_0_60px_-8px_rgba(112,128,255,0.55)] hover:-translate-y-0.5 ' +
      className
    }
  >
    {/* glow border */}
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      style={{
        background:
          'linear-gradient(135deg, rgba(112,128,255,0.18), transparent 40%, rgba(112,128,255,0.18))',
        WebkitMask:
          'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
        WebkitMaskComposite: 'xor',
        padding: 1,
      }}
    />
    {children}
  </div>
);

const SectionHeader: React.FC<{
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: 'left' | 'center';
}> = ({ eyebrow, title, subtitle, align = 'center' }) => (
  <div className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
    {eyebrow && (
      <div
        className={
          'inline-flex items-center gap-2 rounded-full border border-primary/40 bg-black/60 px-3 py-1 ' +
          'text-[10px] uppercase tracking-[0.25em] text-primary shadow-[0_0_18px_rgba(112,128,255,0.35)]'
        }
      >
        <Sparkles className="h-3 w-3" />
        {eyebrow}
      </div>
    )}
    <h2 className="mt-5 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
      {title}
    </h2>
    {subtitle && (
      <p className="mt-4 text-base sm:text-lg text-white/70">{subtitle}</p>
    )}
  </div>
);

/* -------------------------------------------------------------------------- */
/*  1. Hero                                                                   */
/* -------------------------------------------------------------------------- */

const Hero: React.FC = () => (
  <section
    aria-label="D3VONN.IO — AI Business Operating System"
    className="relative isolate overflow-hidden min-h-[100svh] flex items-center"
  >
    {/* Background field */}
    <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_72%_30%,rgba(112,128,255,0.35),transparent_30%),radial-gradient(circle_at_15%_80%,rgba(0,200,255,0.18),transparent_28%),linear-gradient(135deg,#02030a_0%,#070817_50%,#000_100%)]" />
    <div className="absolute inset-0 -z-10 opacity-20 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:48px_48px]" />
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 mix-blend-overlay opacity-30"
      style={{
        backgroundImage:
          'repeating-linear-gradient(0deg, rgba(112,128,255,0.06) 0px, rgba(112,128,255,0.06) 1px, transparent 1px, transparent 3px)',
      }}
    />

    {/* Orbit ring decoration */}
    <div className="pointer-events-none absolute right-[-15%] top-[10%] hidden lg:block">
      <div className="w-[640px] h-[640px] rounded-full border border-primary/30 shadow-[0_0_120px_rgba(112,128,255,0.35)]" />
      <div className="absolute inset-12 rounded-full border border-primary/40" />
      <div className="absolute inset-32 rounded-full border-2 border-primary/50 shadow-[inset_0_0_80px_rgba(112,128,255,0.35)]" />
    </div>

    <div className="container relative mx-auto px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="max-w-3xl"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-black/60 px-4 py-2 text-[10px] sm:text-xs uppercase tracking-[0.25em] text-primary shadow-[0_0_24px_rgba(112,128,255,0.3)]">
          <Bot className="h-4 w-4" />
          AI Business Operating System
        </div>

        <h1 className="mt-8 text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight text-white drop-shadow-[0_0_24px_rgba(255,255,255,0.15)]">
          Welcome to <span className="block text-primary">D3VONN.IO</span>
        </h1>

        <p className="mt-6 max-w-xl text-lg sm:text-xl text-white/85">
          Orchestrate your AI workforce, automate every workflow, and command an
          autonomous business — from one futuristic, enterprise-grade console.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <Link
            to="/app"
            className="group inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-7 py-4 font-semibold text-primary-foreground shadow-[0_0_40px_rgba(112,128,255,0.55)] transition hover:scale-[1.02] hover:shadow-[0_0_60px_rgba(112,128,255,0.8)]"
          >
            Launch D3VONN
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            to="/platform"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-black/40 px-7 py-4 font-semibold text-white backdrop-blur transition hover:bg-white/10 hover:border-primary/40"
          >
            Explore Platform
          </Link>
        </div>

        <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs text-white/70">
          <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Secure by design</span>
          <span className="inline-flex items-center gap-2"><Network className="h-4 w-4 text-primary" /> Multi-agent orchestration</span>
          <span className="inline-flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Real-time intelligence</span>
          <span className="inline-flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /> Web3-ready vault</span>
        </div>
      </motion.div>
    </div>

    {/* Live ribbon */}
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.6 }}
      className="absolute top-20 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 rounded-full border border-primary/40 bg-black/60 backdrop-blur-md text-[10px] sm:text-xs tracking-[0.25em] uppercase text-primary shadow-[0_0_20px_rgba(112,128,255,0.35)]"
    >
      D3VONN.IO · Now Live
    </motion.div>

    {/* Bottom fade */}
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-background" />
  </section>
);

/* -------------------------------------------------------------------------- */
/*  2. Trust strip                                                            */
/* -------------------------------------------------------------------------- */

const TrustStrip: React.FC = () => {
  const partners = [
    'Supabase', 'OpenAI', 'Anthropic', 'AWS', 'Vercel', 'Cloudflare', 'n8n', 'MCP',
  ];
  return (
    <section className="relative border-y border-white/10 bg-black/40 py-10">
      <div className="container mx-auto px-6">
        <p className="text-center text-xs uppercase tracking-[0.3em] text-white/50">
          Powering autonomous operations across the modern stack
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {partners.map((p) => (
            <span
              key={p}
              className="text-sm font-semibold text-white/70 hover:text-primary transition-colors"
            >
              {p}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};

/* -------------------------------------------------------------------------- */
/*  3. Feature grid                                                           */
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
  <section id="platform" className="relative py-24 scroll-mt-24">
    <div className="container mx-auto px-6">
      <SectionHeader
        eyebrow="The Platform"
        title={<>Everything an <span className="text-primary">AI Business</span> needs</>}
        subtitle="One operating system for agents, workflows, memory, and signals — built for the autonomous enterprise."
      />
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
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-[0_0_24px_rgba(112,128,255,0.4)]">
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
/*  4. Marketplace preview                                                    */
/* -------------------------------------------------------------------------- */

const agents = [
  { name: 'Atlas Researcher',  role: 'Web + doc intelligence', tag: 'Knowledge' },
  { name: 'Helios Sales',      role: 'Outbound + CRM ops',     tag: 'Revenue' },
  { name: 'Vault Sentinel',    role: 'Security + compliance',  tag: 'Security' },
  { name: 'Forge Engineer',    role: 'Code + infra automation',tag: 'Engineering' },
];

const MarketplacePreview: React.FC = () => (
  <section id="marketplace" className="relative py-24 bg-gradient-to-b from-transparent via-primary/5 to-transparent scroll-mt-24">
    <div className="container mx-auto px-6">
      <SectionHeader
        eyebrow="Agent Marketplace"
        title={<>Deploy a <span className="text-primary">workforce</span>, not a chatbot</>}
        subtitle="Hand-curated agents ready to run inside your D3VONN command center."
      />
      <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {agents.map((a, i) => (
          <motion.div
            key={a.name}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
          >
            <GlassCard className="group h-full">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center shadow-[0_0_20px_rgba(112,128,255,0.4)]">
                  <Bot className="h-5 w-5" />
                </div>
                <span className="text-[10px] uppercase tracking-widest text-primary/80 border border-primary/30 rounded-full px-2 py-0.5">
                  {a.tag}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-white">{a.name}</h3>
              <p className="mt-1 text-sm text-white/70">{a.role}</p>
              <Link
                to="/marketplace"
                className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-white transition-colors"
              >
                Deploy <ArrowRight className="h-3 w-3" />
              </Link>
            </GlassCard>
          </motion.div>
        ))}
      </div>
      <div className="mt-10 text-center">
        <Link
          to="/marketplace"
          className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-black/40 px-6 py-3 text-sm font-semibold text-white hover:bg-primary/10 transition"
        >
          Browse full marketplace <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  </section>
);

/* -------------------------------------------------------------------------- */
/*  5. Command Center preview                                                 */
/* -------------------------------------------------------------------------- */

const CommandCenterPreview: React.FC = () => (
  <section id="command-center" className="relative py-24 scroll-mt-24">
    <div className="container mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
      <div>
        <SectionHeader
          align="left"
          eyebrow="Command Center"
          title={<>One console. <span className="text-primary">Total control.</span></>}
          subtitle="Supervise every agent, workflow, and signal in real time — with surgical precision."
        />
        <ul className="mt-8 space-y-4 text-sm text-white/80">
          {[
            'Live agent supervision with intervention controls',
            'Cross-mesh telemetry from Hermes Intelligence',
            'Hot-swap models, prompts, and tools mid-run',
            'Encrypted audit trails for every decision',
          ].map((line) => (
            <li key={line} className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_rgba(112,128,255,0.8)]" />
              {line}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex gap-3">
          <Link
            to="/occ"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[0_0_30px_rgba(112,128,255,0.5)] hover:scale-[1.02] transition"
          >
            Open Command Center <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/command-center"
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-black/40 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
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
                <div className="text-xl font-bold text-primary">{s.v}</div>
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
                    className="h-full rounded-full bg-primary shadow-[0_0_10px_rgba(112,128,255,0.8)]"
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
/*  6. Vault ownership                                                        */
/* -------------------------------------------------------------------------- */

const Vault: React.FC = () => (
  <section id="vault" className="relative py-24 bg-gradient-to-b from-transparent via-primary/5 to-transparent scroll-mt-24">
    <div className="container mx-auto px-6">
      <SectionHeader
        eyebrow="Sovereignty Vault"
        title={<>You own your <span className="text-primary">data, agents, and signals</span></>}
        subtitle="Web3-ready ownership layer — without the crypto theatre. Portable, encrypted, yours."
      />
      <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: KeySquare, title: 'Server-side encryption', desc: 'AES-GCM at rest, encrypted via Supabase RPC. Keys never touch the client.' },
          { icon: Layers,    title: 'Portable agents',        desc: 'Export, fork, or migrate any agent definition with full provenance.' },
          { icon: ShieldCheck, title: 'Audit-grade trails',   desc: 'Every action logged to immutable, query-friendly safe views.' },
        ].map((b) => (
          <GlassCard key={b.title} className="group h-full">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-[0_0_24px_rgba(112,128,255,0.4)]">
              <b.icon className="h-6 w-6" />
            </div>
            <h3 className="mt-5 text-xl font-semibold text-white">{b.title}</h3>
            <p className="mt-2 text-sm text-white/70">{b.desc}</p>
          </GlassCard>
        ))}
      </div>
    </div>
  </section>
);

/* -------------------------------------------------------------------------- */
/*  7. Pricing preview                                                        */
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
      <SectionHeader
        eyebrow="Pricing"
        title={<>Built for <span className="text-primary">every scale</span> of autonomy</>}
        subtitle="Transparent tiers. Predictable economics. No surprise tokens."
      />
      <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((p) => (
          <GlassCard
            key={p.name}
            className={
              'flex flex-col h-full ' +
              (p.featured
                ? 'border-primary/50 shadow-[0_0_60px_-8px_rgba(112,128,255,0.7)]'
                : '')
            }
          >
            {p.featured && (
              <div className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-[10px] uppercase tracking-widest text-primary-foreground shadow-[0_0_20px_rgba(112,128,255,0.7)]">
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
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(112,128,255,0.8)]" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              to={p.name === 'Enterprise' ? '/contact' : '/app'}
              className={
                'mt-6 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition ' +
                (p.featured
                  ? 'bg-primary text-primary-foreground shadow-[0_0_30px_rgba(112,128,255,0.5)] hover:scale-[1.02]'
                  : 'border border-white/20 bg-black/40 text-white hover:bg-white/10')
              }
            >
              {p.cta} <ArrowRight className="h-4 w-4" />
            </Link>
          </GlassCard>
        ))}
      </div>
    </div>
  </section>
);

/* -------------------------------------------------------------------------- */
/*  Final CTA + Page shell                                                    */
/* -------------------------------------------------------------------------- */

const FinalCTA: React.FC = () => (
  <section className="relative py-24">
    <div className="container mx-auto px-6">
      <GlassCard className="text-center py-14">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/40 bg-black/60 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-primary shadow-[0_0_18px_rgba(112,128,255,0.35)]">
          <Rocket className="h-3 w-3" /> Ready when you are
        </div>
        <h2 className="mt-5 text-3xl sm:text-5xl font-black text-white">
          Launch your <span className="text-primary">autonomous business</span>.
        </h2>
        <p className="mt-4 max-w-xl mx-auto text-white/70">
          The future of work isn't headcount — it's orchestration. Start with D3VONN.IO today.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/app"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-7 py-4 font-semibold text-primary-foreground shadow-[0_0_40px_rgba(112,128,255,0.55)] hover:scale-[1.02] transition"
          >
            Launch D3VONN <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/platform"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-black/40 px-7 py-4 font-semibold text-white hover:bg-white/10 transition"
          >
            Explore Platform
          </Link>
        </div>
      </GlassCard>
    </div>
  </section>
);

const Index: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  const title = 'D3VONN.IO — AI Business Operating System';
  const description =
    'D3VONN.IO is the AI Business Operating System — orchestrate your AI workforce, automate workflows, and command an autonomous enterprise from one console.';
  const url = 'https://d3vonn.io/';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen flex flex-col bg-background text-foreground overflow-hidden"
    >
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-primary z-50 origin-left shadow-[0_0_12px_rgba(112,128,255,0.7)]"
        style={{ scaleX }}
      />
      <AuthNavButton />

      <Hero />
      <TrustStrip />
      <FeatureGrid />
      <MarketplacePreview />
      <CommandCenterPreview />
      <Vault />
      <Pricing />
      <FinalCTA />

      <Footer />
    </motion.div>
  );
};

export default Index;
