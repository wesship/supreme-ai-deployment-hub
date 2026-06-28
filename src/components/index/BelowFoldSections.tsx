import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Bot, Brain, Workflow, Database, Cpu, ShieldCheck, Activity,
  Network, Server, KeyRound, FileCheck, MonitorCheck, GitBranch, CheckCircle2,
  Sparkles, BarChart3, Rocket, Lock, Play, Gauge,
} from 'lucide-react';
import SmartLaunchLink from '@/components/SmartLaunchLink';
import LiveStatsBar from '@/components/index/LiveStatsBar';
import LiveStatsCommandCenter from '@/components/index/LiveStatsCommandCenter';

const GlassCard: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...rest }) => (
  <div
    {...rest}
    className={
      'relative rounded-2xl border border-blue-200/15 bg-blue-300/[0.055] p-6 backdrop-blur-xl ' +
      'shadow-[0_0_44px_-16px_rgba(56,136,255,0.38)] transition-all duration-300 ' +
      'hover:border-blue-200/35 hover:shadow-[0_0_70px_-14px_rgba(56,136,255,0.56)] hover:-translate-y-0.5 ' +
      className
    }
  >
    {children}
  </div>
);

const SectionEyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200/80">{children}</p>
);

const SectionShell: React.FC<React.HTMLAttributes<HTMLElement>> = ({ className = '', children, ...rest }) => (
  <section {...rest} className={'relative bg-[#031f4f] py-24 scroll-mt-24 ' + className}>
    <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_0%,rgba(29,142,255,0.14),transparent_38%)]" />
    <div className="container relative mx-auto px-6">{children}</div>
  </section>
);

const trustMetrics = [
  ['Railway API', 'Live', Gauge],
  ['Vercel frontend', 'Live', Rocket],
  ['Hermes orchestration', 'Online', Brain],
  ['Supabase + Pinecone', 'RAG ready', Database],
  ['CI checks', '41/41', CheckCircle2],
  ['Test suite', '573 passing', Activity],
];

const TrustLayer: React.FC = () => (
  <SectionShell id="trust" className="pt-20">
    <div className="mx-auto max-w-3xl text-center">
      <SectionEyebrow>Production Trust Layer</SectionEyebrow>
      <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
        Proof before promises.
      </h2>
      <p className="mt-4 text-base text-blue-100/72">
        D3VONN.IO presents the platform as a working AI Business Operating System with deployment, orchestration, memory, security, and command visibility already part of the story.
      </p>
    </div>
    <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {trustMetrics.map(([label, value, Icon]) => (
        <GlassCard key={label as string} className="p-4 text-center">
          <Icon className="mx-auto h-5 w-5 text-blue-200" />
          <div className="mt-3 text-xl font-black text-white">{value as string}</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-blue-100/58">{label as string}</div>
        </GlassCard>
      ))}
    </div>
  </SectionShell>
);

const agentCards = [
  { icon: Brain, name: 'Hermes', role: 'Orchestrator', desc: 'Plans goals, assigns tasks, manages checkpoints, and keeps humans in control.' },
  { icon: BarChart3, name: 'Strategist', role: 'Research + GTM', desc: 'Maps markets, competitors, offers, opportunities, and action paths.' },
  { icon: Workflow, name: 'Operator', role: 'Workflow Agent', desc: 'Runs business workflows across CRM, docs, automations, and operations.' },
  { icon: Sparkles, name: 'Creator', role: 'Content Studio', desc: 'Produces campaign assets, documents, code, visuals, and messaging.' },
  { icon: Lock, name: 'Sentinel', role: 'Security Agent', desc: 'Monitors risk, reviews controls, and keeps audit evidence organized.' },
  { icon: Server, name: 'DevOps', role: 'Deployment Agent', desc: 'Tracks builds, incidents, health, infrastructure, and production readiness.' },
  { icon: FileCheck, name: 'BioCompliance', role: 'QA Documentation', desc: 'Maps regulated requirements, SOP drafts, validations, and audit packets.' },
  { icon: Bot, name: 'Insurance Agent', role: 'Client Ops', desc: 'Supports lead intake, follow-up, policy education, and licensed workflow routing.' },
];

const AIWorkforce: React.FC = () => (
  <SectionShell id="agents">
    <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
      <div>
        <SectionEyebrow>AI Workforce</SectionEyebrow>
        <h2 className="mt-4 text-3xl font-black leading-tight text-white sm:text-4xl lg:text-5xl">
          Deploy specialized agents under one command layer.
        </h2>
        <p className="mt-4 text-base text-blue-100/72">
          The homepage now shows the product: a supervised workforce of agents for sales, research, operations, DevOps, security, compliance, and content execution.
        </p>
        <Link to="/agents" className="mt-8 inline-flex items-center gap-2 rounded-xl border border-blue-200/25 bg-blue-300/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-300/15">
          Explore Agent Marketplace <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {agentCards.map((agent, i) => (
          <motion.div key={agent.name} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45, delay: i * 0.04 }}>
            <GlassCard className="h-full">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-200/25 bg-blue-500/20 text-blue-100">
                  <agent.icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{agent.name}</h3>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-blue-100/55">{agent.role}</p>
                  <p className="mt-3 text-sm text-blue-100/68">{agent.desc}</p>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </div>
  </SectionShell>
);

const workflowSteps = [
  ['Intent', 'A founder enters a plain-language business goal.'],
  ['Hermes Plans', 'The orchestrator breaks it into tasks, dependencies, tools, approvals, and memory lookups.'],
  ['Agents Execute', 'Specialized agents perform research, operations, content, DevOps, or compliance work.'],
  ['Human Governs', 'Approvals, checkpoints, risk flags, and audit logs remain visible in the Command Center.'],
  ['Output Ships', 'Final documents, automations, insights, and next actions are delivered.'],
];

const ProductDemo: React.FC = () => (
  <SectionShell id="demo">
    <div className="mx-auto max-w-3xl text-center">
      <SectionEyebrow>Interactive Product Demo</SectionEyebrow>
      <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
        See Hermes think before agents act.
      </h2>
      <p className="mt-4 text-base text-blue-100/72">
        This walkthrough makes D3VONN.IO concrete: objective in, orchestration plan out, agent execution visible, human approval preserved.
      </p>
    </div>
    <div className="mt-14 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
      <GlassCard className="overflow-hidden p-0">
        <div className="border-b border-blue-200/12 bg-blue-400/10 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-blue-100/55">Mission</p>
              <h3 className="mt-1 text-xl font-black text-white">Build a 30-day enterprise pipeline</h3>
            </div>
            <span className="rounded-full border border-blue-200/25 bg-blue-500/15 px-3 py-1 text-[10px] uppercase tracking-widest text-blue-100">Active</span>
          </div>
        </div>
        <div className="space-y-4 p-5">
          {workflowSteps.map(([label, body], index) => (
            <div key={label} className="grid gap-4 rounded-xl border border-blue-200/12 bg-blue-950/20 p-4 sm:grid-cols-[44px_1fr]">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-blue-200/25 bg-blue-500/18 text-sm font-black text-blue-100">{index + 1}</div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-white">{label}</h4>
                  {index < workflowSteps.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-blue-200/60" />}
                </div>
                <p className="mt-1 text-sm text-blue-100/66">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
      <GlassCard className="flex flex-col justify-between">
        <div>
          <SectionEyebrow>Command Center Preview</SectionEyebrow>
          <h3 className="mt-4 text-2xl font-black text-white">Every run is observable.</h3>
          <p className="mt-3 text-sm text-blue-100/70">The console shows agent state, progress, approvals, telemetry, and the next recommended operator action.</p>
        </div>
        <div className="mt-8 rounded-2xl border border-blue-200/12 bg-blue-950/30 p-4">
          <div className="grid grid-cols-3 gap-3">
            {[['Agents', '24'], ['Tasks/min', '318'], ['Latency', '42ms']].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-blue-200/12 bg-blue-400/10 p-3 text-center">
                <div className="text-xl font-black text-white">{value}</div>
                <div className="mt-1 text-[10px] uppercase tracking-widest text-blue-100/55">{label}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-3">
            {[['Hermes', 'Planning', 92], ['Strategist', 'Market map', 74], ['Operator', 'CRM workflow', 61], ['Creator', 'Pitch assets', 48]].map(([agent, job, pct]) => (
              <div key={agent as string} className="rounded-xl border border-blue-200/12 bg-blue-950/25 p-3">
                <div className="flex justify-between text-xs"><span className="font-semibold text-white">{agent}</span><span className="text-blue-100/58">{job}</span></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-blue-950/70"><div className="h-full rounded-full bg-blue-300 shadow-[0_0_12px_rgba(147,197,253,0.85)]" style={{ width: `${pct}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <SmartLaunchLink authedTo="/app" className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600/85 px-5 py-3 text-sm font-semibold text-white shadow-[0_0_30px_rgba(56,136,255,0.42)] transition hover:scale-[1.02]">
            Launch Dashboard <ArrowRight className="h-4 w-4" />
          </SmartLaunchLink>
          <Link to="/command-center" className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200/25 bg-blue-300/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-300/15">
            <Play className="h-4 w-4" /> Tour Console
          </Link>
        </div>
      </GlassCard>
    </div>
  </SectionShell>
);

const features = [
  { icon: Brain, title: 'Autonomous Agents', desc: 'Goal-driven AI workers that plan, execute, and self-correct across tools.' },
  { icon: Workflow, title: 'Workflow Engine', desc: 'Repeatable DAG orchestration with approvals, checkpoints, and tool routing.' },
  { icon: Database, title: 'Knowledge Vault', desc: 'RAG memory layer for business context, documents, decisions, and reusable knowledge.' },
  { icon: Cpu, title: 'Hermes Intelligence', desc: 'Canonical orchestration layer for task state, review, recovery, and execution visibility.' },
  { icon: Lock, title: 'Enterprise Security', desc: 'Secure routing, audit trails, access boundaries, and a roadmap toward SSO/RBAC.' },
  { icon: Activity, title: 'Live Observability', desc: 'Runs, logs, health signals, CI status, and operational metrics in one control surface.' },
];

const PlatformFeatures: React.FC = () => (
  <SectionShell id="platform">
    <div className="mx-auto max-w-3xl text-center">
      <SectionEyebrow>The Platform</SectionEyebrow>
      <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">Everything an <span className="text-blue-200">AI Business</span> needs.</h2>
      <p className="mt-4 text-base text-blue-100/72">Agents, workflows, memory, signals, governance, and proof — built as one operating layer.</p>
    </div>
    <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {features.map((f, i) => (
        <motion.div key={f.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45, delay: i * 0.05 }}>
          <GlassCard className="h-full">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-blue-200/25 bg-blue-500/20 text-blue-100"><f.icon className="h-6 w-6" /></div>
            <h3 className="mt-5 text-xl font-semibold text-white">{f.title}</h3>
            <p className="mt-2 text-sm text-blue-100/68">{f.desc}</p>
          </GlassCard>
        </motion.div>
      ))}
    </div>
  </SectionShell>
);

const readiness = [
  { icon: ShieldCheck, title: 'Security', desc: 'CSP, secure proxy boundaries, audit-friendly routes, and controlled app access.' },
  { icon: KeyRound, title: 'Identity Path', desc: 'Roadmap toward SSO, RBAC, enterprise roles, and approval separation.' },
  { icon: FileCheck, title: 'Audit Evidence', desc: 'Decision trails, task checkpoints, review states, and evidence-ready outputs.' },
  { icon: MonitorCheck, title: 'Status', desc: 'Health, runtime signals, deployments, test readiness, and command visibility.' },
  { icon: Server, title: 'Deployment', desc: 'Cloud-first with a path toward private, VPC, and enterprise deployment models.' },
  { icon: Network, title: 'Integrations', desc: 'API-first connectors for workflows, docs, CRM, automation, and MCP-style tools.' },
];

const EnterpriseReadiness: React.FC = () => (
  <SectionShell id="enterprise">
    <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
      <div>
        <SectionEyebrow>Business Proof</SectionEyebrow>
        <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">Built to earn enterprise trust.</h2>
        <p className="mt-4 text-base text-blue-100/72">The trust layer connects security, architecture, documentation, roadmap, status, and pilot-readiness into a clear buying story.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to="/security" className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600/85 px-5 py-3 text-sm font-semibold text-white shadow-[0_0_30px_rgba(56,136,255,0.42)] transition hover:scale-[1.02]">Security <ArrowRight className="h-4 w-4" /></Link>
          <Link to="/roadmap" className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200/25 bg-blue-300/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-300/15">Roadmap</Link>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {readiness.map((item) => (
          <GlassCard key={item.title} className="h-full">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-200/25 bg-blue-500/20 text-blue-100"><item.icon className="h-5 w-5" /></div>
            <h3 className="mt-4 text-lg font-semibold text-white">{item.title}</h3>
            <p className="mt-2 text-sm text-blue-100/66">{item.desc}</p>
          </GlassCard>
        ))}
      </div>
    </div>
  </SectionShell>
);

const architectureNodes = [
  ['User Goal', 'Plain-language objective'],
  ['Hermes', 'Orchestration + task planning'],
  ['Agent Mesh', 'Specialized execution'],
  ['Workflow Engine', 'DAGs, tools, approvals'],
  ['Knowledge Vault', 'RAG + memory context'],
  ['Command Center', 'Telemetry + governance'],
];

const ArchitectureMap: React.FC = () => (
  <SectionShell id="architecture">
    <div className="mx-auto max-w-3xl text-center">
      <SectionEyebrow>Architecture</SectionEyebrow>
      <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">The operating layer behind the workforce.</h2>
      <p className="mt-4 text-base text-blue-100/72">A simple technical story: intent enters, Hermes orchestrates, agents execute, memory grounds, and the Command Center governs.</p>
    </div>
    <GlassCard className="mt-14 overflow-hidden">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {architectureNodes.map(([title, desc], index) => (
          <div key={title} className="relative rounded-xl border border-blue-200/12 bg-blue-950/25 p-4">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-200/25 bg-blue-500/18 text-blue-100">
                {index === 0 ? <GitBranch className="h-4 w-4" /> : <Network className="h-4 w-4" />}
              </div>
              {index < architectureNodes.length - 1 && <ArrowRight className="hidden h-4 w-4 text-blue-200/60 xl:block" />}
            </div>
            <h3 className="mt-4 text-base font-bold text-white">{title}</h3>
            <p className="mt-2 text-xs text-blue-100/55">{desc}</p>
          </div>
        ))}
      </div>
    </GlassCard>
  </SectionShell>
);

const plans = [
  { name: 'Starter', price: '$0', period: '/mo', desc: 'Explore agents and learn the operating model.', features: ['Standard agent library', 'Basic dashboard', 'Community support'], cta: 'Start Free', featured: false },
  { name: 'Plus', price: '$49', period: '/mo', desc: 'Access membership for serious builders.', features: ['Plus-only agents', '500 API credits/mo', '50% off marketplace fees', 'Priority email support', 'Advanced performance data'], cta: 'Join Plus', featured: true },
  { name: 'Pro', price: '$149', period: '/mo', desc: 'Run a stronger AI workforce with more capacity.', features: ['All Pro-only agents', '2,000 API credits/mo', '0% marketplace fees', 'Predictive scaling insights', 'Beta program access'], cta: 'Launch Pro', featured: false },
  { name: 'Business', price: '$499', period: '/mo', desc: 'Team-level operations and stronger controls.', features: ['Team workspace', 'Workflow governance', 'Admin controls', 'Priority roadmap input', 'Business onboarding'], cta: 'Start Business', featured: false },
  { name: 'Enterprise', price: 'Custom', period: '', desc: 'Private deployment paths and dedicated support.', features: ['SSO/RBAC path', 'VPC/on-prem options', 'Dedicated success advisor', 'Security review', 'Custom integrations'], cta: 'Schedule Demo', featured: false },
];

const Pricing: React.FC = () => (
  <SectionShell id="pricing">
    <div className="mx-auto max-w-3xl text-center">
      <SectionEyebrow>Pricing</SectionEyebrow>
      <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">D3VONN.IO Plus is the membership layer.</h2>
      <p className="mt-4 text-base text-blue-100/72">Start free, upgrade into access, then scale into Pro, Business, or Enterprise as the workforce becomes operational.</p>
      <div className="mt-5 inline-flex rounded-full border border-blue-200/20 bg-blue-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-100/70">Founder Plus: first 50 users at $29/mo</div>
    </div>
    <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-5">
      {plans.map((p) => (
        <GlassCard key={p.name} className={(p.featured ? 'border-blue-200/50 shadow-[0_0_70px_-14px_rgba(147,197,253,0.7)] ' : '') + 'flex h-full flex-col'}>
          {p.featured && <div className="absolute -top-3 left-6 rounded-full bg-blue-500 px-3 py-1 text-[10px] uppercase tracking-widest text-white shadow-[0_0_20px_rgba(147,197,253,0.7)]">Best value</div>}
          <h3 className="text-xl font-semibold text-white">{p.name}</h3>
          <div className="mt-3 flex items-baseline gap-1"><span className="text-4xl font-black text-white">{p.price}</span><span className="text-sm text-blue-100/60">{p.period}</span></div>
          <p className="mt-3 text-sm text-blue-100/70">{p.desc}</p>
          <ul className="mt-5 flex-1 space-y-2 text-sm text-blue-100/80">
            {p.features.map((f) => <li key={f} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-200" />{f}</li>)}
          </ul>
          {p.name === 'Enterprise' ? (
            <Link to="/contact?inquiry=enterprise-demo" className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200/25 bg-blue-300/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-300/15">{p.cta} <ArrowRight className="h-4 w-4" /></Link>
          ) : (
            <SmartLaunchLink authedTo="/app" className={(p.featured ? 'bg-blue-600/90 shadow-[0_0_30px_rgba(56,136,255,0.45)] ' : 'border border-blue-200/25 bg-blue-300/10 ') + 'mt-6 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.02]'}>{p.cta} <ArrowRight className="h-4 w-4" /></SmartLaunchLink>
          )}
        </GlassCard>
      ))}
    </div>
  </SectionShell>
);

const FinalCTA: React.FC = () => (
  <SectionShell className="pb-28">
    <GlassCard className="overflow-hidden py-14 text-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,136,255,0.18),transparent_60%)]" />
      <div className="relative">
        <SectionEyebrow>Ready when you are</SectionEyebrow>
        <h2 className="mt-5 text-3xl font-black text-white sm:text-5xl">Launch your <span className="text-blue-200">autonomous business</span>.</h2>
        <p className="mx-auto mt-4 max-w-xl text-blue-100/70">The future of work is not more dashboards. It is supervised AI orchestration.</p>
        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <SmartLaunchLink authedTo="/app" className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600/90 px-7 py-4 font-semibold text-white shadow-[0_0_40px_rgba(56,136,255,0.45)] transition hover:scale-[1.02]">Launch Command Center <ArrowRight className="h-4 w-4" /></SmartLaunchLink>
          <Link to="/contact?inquiry=enterprise-demo" className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200/25 bg-blue-300/10 px-7 py-4 font-semibold text-white transition hover:bg-blue-300/15">Schedule Enterprise Demo</Link>
        </div>
      </div>
    </GlassCard>
  </SectionShell>
);

const BelowFoldSections: React.FC = () => (
  <>
    <TrustLayer />
    <ProductDemo />
    <LiveStatsBar />
    <AIWorkforce />
    <PlatformFeatures />
    <EnterpriseReadiness />
    <ArchitectureMap />
    <LiveStatsCommandCenter />
    <Pricing />
    <FinalCTA />
  </>
);

export default BelowFoldSections;
