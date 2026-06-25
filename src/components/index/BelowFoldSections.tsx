/**
 * BelowFoldSections — lazy-loaded chunk containing all homepage sections
 * that appear below the fold (Platform, Stats, Features, Command Center,
 * Pricing, Final CTA). This keeps the initial JS bundle small for fast FCP.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowRight, ArrowLeft, Bot, Brain, Workflow, Database,
  Cpu, Lock, Activity, ChevronRight, Infinity, ShieldCheck,
  Network, Server, KeyRound, FileCheck, MonitorCheck, GitBranch,
} from 'lucide-react';
import SmartLaunchLink from '@/components/SmartLaunchLink';
import LiveStatsBar from '@/components/index/LiveStatsBar';
import LiveStatsCommandCenter from '@/components/index/LiveStatsCommandCenter';

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

const SectionEyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-xs uppercase tracking-[0.2em] text-blue-400 font-semibold">{children}</p>
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
        <div>
          <SectionEyebrow>The D3VONN Platform</SectionEyebrow>
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
/*  4. Product walkthrough — show the operating system, not just the promise   */
/* -------------------------------------------------------------------------- */

const workflowSteps = [
  { label: 'Your Goal', body: 'Launch a campaign, analyze a market, build a workflow, or run an operation.' },
  { label: 'Hermes Thinks', body: 'Breaks the objective into tasks, dependencies, tools, and checkpoints.' },
  { label: 'Strategist Plans', body: 'Generates positioning, competitive moves, and execution logic.' },
  { label: 'Operator Executes', body: 'Runs workflows, routes tasks, updates systems, and watches failures.' },
  { label: 'Creator Produces', body: 'Creates content, visuals, documents, code, and campaign assets.' },
  { label: 'Results Appear', body: 'Outputs, audit logs, status, and next actions land in the Command Center.' },
];

const ProductWalkthrough: React.FC = () => (
  <section id="product-walkthrough" className="relative py-24 scroll-mt-24">
    <div className="container mx-auto px-6">
      <div className="mx-auto max-w-3xl text-center">
        <SectionEyebrow>Product Walkthrough</SectionEyebrow>
        <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
          From business intent to <span className="text-blue-400">agent execution</span>
        </h2>
        <p className="mt-4 text-base text-white/70">
          D3VONN.IO turns a plain-language objective into coordinated work across Hermes, Strategist, Operator, and Creator.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8 items-stretch">
        <GlassCard className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/50">Mission Control</p>
              <h3 className="mt-1 text-xl font-bold text-white">Build Q1 enterprise pipeline</h3>
            </div>
            <span className="rounded-full border border-blue-500/30 bg-blue-950/40 px-3 py-1 text-[10px] uppercase tracking-widest text-blue-300">
              Active Run
            </span>
          </div>

          <div className="mt-6 space-y-4">
            {workflowSteps.map((step, index) => (
              <div key={step.label} className="relative grid gap-4 rounded-xl border border-white/10 bg-black/25 p-4 sm:grid-cols-[44px_1fr]">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-blue-500/30 bg-blue-600/15 text-sm font-black text-blue-300">
                  {index + 1}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-white">{step.label}</h4>
                    {index < 5 && <ArrowRight className="h-3.5 w-3.5 text-blue-400/70" />}
                  </div>
                  <p className="mt-1 text-sm text-white/65">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="flex flex-col justify-between bg-gradient-to-b from-blue-950/20 to-transparent">
          <div>
            <SectionEyebrow>Hermes Dashboard Preview</SectionEyebrow>
            <h3 className="mt-4 text-2xl font-black text-white">Every agent visible. Every task accountable.</h3>
            <p className="mt-3 text-sm text-white/70">
              Investors and enterprise buyers do not just see a brand. They see a working operating layer for autonomous business execution.
            </p>
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-black/40 p-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Hermes', 'Planning', '98%'],
                ['Strategist', 'Market map', '74%'],
                ['Operator', 'CRM workflow', '62%'],
                ['Creator', 'Pitch assets', '47%'],
              ].map(([agent, job, progress]) => (
                <div key={agent} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-sm font-bold text-white">{agent}</div>
                  <div className="mt-1 text-[11px] text-white/50">{job}</div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-blue-500 shadow-[0_0_10px_rgba(56,136,255,0.8)]" style={{ width: progress }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-950/20 p-4 text-sm text-white/75">
              Next action: Hermes requests approval to launch the outbound sequence and generate the investor-ready summary.
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <SmartLaunchLink
              authedTo="/app"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_0_30px_rgba(56,136,255,0.4)] hover:scale-[1.02] transition"
            >
              Launch Dashboard <ArrowRight className="h-4 w-4" />
            </SmartLaunchLink>
            <Link
              to="/contact?inquiry=enterprise-demo"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
            >
              Schedule Enterprise Demo
            </Link>
          </div>
        </GlassCard>
      </div>
    </div>
  </section>
);

/* -------------------------------------------------------------------------- */
/*  5. Stats bar                                                              */
/* -------------------------------------------------------------------------- */

const stats = [
  { value: '99.9%', label: 'System Uptime' },
  { value: '∞', label: 'Scalable Agents' },
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
/*  6. Feature grid                                                           */
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
        <SectionEyebrow>The Platform</SectionEyebrow>
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
/*  7. Enterprise readiness                                                   */
/* -------------------------------------------------------------------------- */

const readiness = [
  { icon: ShieldCheck, title: 'Security-First Architecture', desc: 'CSP, HSTS, frame protection, server-side proxy boundaries, and private application routes.' },
  { icon: KeyRound, title: 'SSO + RBAC Path', desc: 'Built to support enterprise identity, role separation, and controlled access to agent operations.' },
  { icon: FileCheck, title: 'Auditability', desc: 'Decision trails, run status, task checkpoints, and operator supervision for accountable automation.' },
  { icon: MonitorCheck, title: 'Observability', desc: 'Live status views, health metrics, execution logs, and production readiness checks.' },
  { icon: Server, title: 'Deployment Flexibility', desc: 'Cloud-first today with a path toward VPC, private, and sovereign deployment models.' },
  { icon: Network, title: 'Integration Layer', desc: 'Designed around APIs, MCP-style tooling, workflow orchestration, and business system connectors.' },
];

const EnterpriseReadiness: React.FC = () => (
  <section id="enterprise" className="relative py-24 scroll-mt-24">
    <div className="container mx-auto px-6">
      <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <div>
          <SectionEyebrow>Enterprise Readiness</SectionEyebrow>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
            Built to earn <span className="text-blue-400">enterprise trust</span>
          </h2>
          <p className="mt-4 text-base text-white/70">
            D3VONN.IO presents as a premium AI operating system, but the enterprise story is about control, security, visibility, and reliable execution.
          </p>
          <Link
            to="/contact?inquiry=enterprise"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_30px_rgba(56,136,255,0.4)] hover:scale-[1.02] transition"
          >
            Schedule Enterprise Demo <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {readiness.map((item) => (
            <GlassCard key={item.title} className="h-full">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-950/50 text-blue-400">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm text-white/65">{item.desc}</p>
            </GlassCard>
          ))}
        </div>
      </div>
    </div>
  </section>
);

/* -------------------------------------------------------------------------- */
/*  8. Architecture map                                                       */
/* -------------------------------------------------------------------------- */

const architectureNodes = [
  ['User Goal', 'Plain-language objective'],
  ['Hermes', 'Orchestration + task planning'],
  ['Agent Mesh', 'Strategist / Operator / Creator'],
  ['Workflow Engine', 'DAGs, tools, approvals'],
  ['Knowledge Vault', 'Memory, RAG, business context'],
  ['Command Center', 'Telemetry, audit, intervention'],
];

const ArchitectureMap: React.FC = () => (
  <section id="architecture" className="relative py-24 scroll-mt-24">
    <div className="container mx-auto px-6">
      <div className="mx-auto max-w-3xl text-center">
        <SectionEyebrow>Architecture</SectionEyebrow>
        <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
          The operating layer behind the <span className="text-blue-400">AI workforce</span>
        </h2>
        <p className="mt-4 text-base text-white/70">
          A simple mental model for investors, buyers, and technical evaluators: intent enters, Hermes orchestrates, agents execute, and the Command Center governs.
        </p>
      </div>

      <GlassCard className="mt-14 overflow-hidden">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {architectureNodes.map(([title, desc], index) => (
            <div key={title} className="relative rounded-xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600/20 text-blue-300 border border-blue-500/30">
                  {index === 0 ? <GitBranch className="h-4 w-4" /> : <Network className="h-4 w-4" />}
                </div>
                {index < architectureNodes.length - 1 && <ArrowRight className="hidden h-4 w-4 text-blue-400/60 xl:block" />}
              </div>
              <h3 className="mt-4 text-base font-bold text-white">{title}</h3>
              <p className="mt-2 text-xs text-white/55">{desc}</p>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  </section>
);

/* -------------------------------------------------------------------------- */
/*  9. Investor proof                                                         */
/* -------------------------------------------------------------------------- */

const pilotScenarios = [
  { title: 'Sales Operations', metric: 'Pipeline acceleration', desc: 'Hermes plans outreach, Operator updates systems, Creator generates assets, Strategist tracks market movement.' },
  { title: 'Executive Research', metric: 'Decision velocity', desc: 'Autonomous research briefs, competitive summaries, and meeting-ready insight packs.' },
  { title: 'Workflow Automation', metric: 'Operational leverage', desc: 'Multi-step business processes move from manual execution to supervised autonomous runs.' },
];

const InvestorProof: React.FC = () => (
  <section id="investors" className="relative py-24 scroll-mt-24">
    <div className="container mx-auto px-6">
      <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
        <div>
          <SectionEyebrow>Investor & Pilot Readiness</SectionEyebrow>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
            A platform story that moves beyond <span className="text-blue-400">AI hype</span>
          </h2>
          <p className="mt-4 text-base text-white/70">
            D3VONN.IO is positioned around a clear enterprise thesis: companies will not just buy AI chat. They will operate AI workforces.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3 text-center">
            {[
              ['4', 'Core Agents'],
              ['1', 'Command Layer'],
              ['24/7', 'Execution Model'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-2xl font-black text-white">{value}</div>
                <div className="mt-1 text-[10px] uppercase tracking-widest text-white/45">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {pilotScenarios.map((scenario) => (
            <GlassCard key={scenario.title}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">{scenario.title}</h3>
                  <p className="mt-2 text-sm text-white/65">{scenario.desc}</p>
                </div>
                <span className="rounded-full border border-blue-500/25 bg-blue-950/30 px-3 py-1 text-[10px] uppercase tracking-widest text-blue-300">
                  {scenario.metric}
                </span>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </div>
  </section>
);

/* -------------------------------------------------------------------------- */
/*  10. Command Center preview                                                */
/* -------------------------------------------------------------------------- */

const CommandCenterPreview: React.FC = () => (
  <section id="command-center" className="relative py-24 scroll-mt-24">
    <div className="container mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
      <div>
        <SectionEyebrow>Command Center</SectionEyebrow>
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
/*  11. Pricing                                                               */
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
    features: ['On-prem / VPC path', 'Custom SSO + RBAC', 'Dedicated engineering'],
    cta: 'Schedule demo',
    featured: false,
  },
];

const Pricing: React.FC = () => (
  <section id="pricing" className="relative py-24 scroll-mt-24">
    <div className="container mx-auto px-6">
      <div className="mx-auto max-w-3xl text-center">
        <SectionEyebrow>Pricing</SectionEyebrow>
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
                to="/contact?inquiry=enterprise-demo"
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
/*  12. Final CTA                                                             */
/* -------------------------------------------------------------------------- */

const FinalCTA: React.FC = () => (
  <section className="relative py-24">
    <div className="container mx-auto px-6">
      <GlassCard className="text-center py-14">
        <SectionEyebrow>Ready when you are</SectionEyebrow>
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
            to="/contact?inquiry=enterprise-demo"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-7 py-4 font-semibold text-white hover:bg-white/10 transition"
          >
            Schedule Enterprise Demo
          </Link>
        </div>
      </GlassCard>
    </div>
  </section>
);

/* -------------------------------------------------------------------------- */
/*  Composed export                                                           */
/* -------------------------------------------------------------------------- */

const BelowFoldSections: React.FC = () => (
  <>
    <PlatformSection />
    <ProductWalkthrough />
    <LiveStatsBar />
    <FeatureGrid />
    <EnterpriseReadiness />
    <ArchitectureMap />
    <InvestorProof />
    <LiveStatsCommandCenter />
    <CommandCenterPreview />
    <Pricing />
    <FinalCTA />
  </>
);

export default BelowFoldSections;
