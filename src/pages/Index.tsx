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
  Building2,
  Command,
  Globe2,
  Terminal,
} from 'lucide-react';
import HomepageShell from '@/components/homepage/HomepageShell';
import HomepageCTAGroup from '@/components/homepage/HomepageCTAGroup';
import HermesOrchestrationDemo from '@/components/home/HermesOrchestrationDemo';
import KnowledgeGraphPreview from '@/components/home/KnowledgeGraphPreview';
import MarketplacePreview from '@/components/home/MarketplacePreview';
import TrustCenterPreview from '@/components/home/TrustCenterPreview';
import SmartLaunchLink from '@/components/SmartLaunchLink';
import PlatformVideosSection from '@/components/home/PlatformVideosSection';
import {
  defaultHomepageTelemetry,
  fetchHomepageTelemetry,
  type HomepageTelemetry,
} from '@/lib/homepageTelemetry';

const MASTER_LOGO_SRC = '/d3vonn-logo-clean.png?v=20260801-clean';
const ENTERPRISE_CORE_SRC = '/d3vonn-enterprise-core.webp?v=20260904-perf';

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
      width={1170}
      height={320}
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

  const coreModules = [
    { label: 'AI Workforce', value: telemetry.activeAgents, icon: Users, to: '/agents' },
    { label: 'Automation', value: telemetry.workflowsToday, icon: Workflow, to: '/workflows' },
    { label: 'Knowledge', value: telemetry.knowledgeNodes, icon: Network, to: '/dkos-ingestion' },
    { label: 'System Health', value: telemetry.systemStatus, icon: Activity, to: '/status' },
  ];

  return (
    <section
      aria-label="D3VONN.IO — AI Business Operating System"
      className="relative isolate overflow-hidden bg-[#010611]"
    >
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_72%_36%,rgba(37,126,255,0.22),transparent_30%),radial-gradient(circle_at_18%_12%,rgba(39,95,190,0.14),transparent_34%),linear-gradient(135deg,#010611_0%,#03122d_48%,#02091a_100%)]" />
      <div className="absolute inset-0 -z-10 opacity-25 bg-[linear-gradient(rgba(100,170,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(100,170,255,0.05)_1px,transparent_1px)] bg-[size:80px_80px]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/55 to-transparent" />

      <div className="container mx-auto px-4 pb-16 pt-16 sm:px-6 sm:pb-24 sm:pt-24 lg:pb-28 lg:pt-28">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,0.88fr)_minmax(520px,1.12fr)] xl:gap-20">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
            className="relative z-10 max-w-2xl"
          >
            <div className="d3-system-status">D3 Core operational</div>
            <p className="mt-7 text-xs font-bold uppercase tracking-[0.28em] text-blue-200/70">
              The central operating system for intelligent business
            </p>
            <h1 className="mt-5 text-balance text-[clamp(3.1rem,6vw,6.7rem)] font-black leading-[0.9] tracking-[-0.055em] text-white">
              Intelligence,
              <span className="block bg-gradient-to-r from-blue-100 via-blue-300 to-cyan-300 bg-clip-text text-transparent">
                under command.
              </span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-blue-50/72 sm:text-xl">
              Orchestrate agents, knowledge, workflows, security, and business operations from one governed command layer.
            </p>

            <HomepageCTAGroup className="mt-9" />

            <div className="mt-9 grid grid-cols-3 gap-3 border-t border-white/10 pt-6">
              {[
                ['Hermes', 'Orchestration'],
                ['DKOS', 'Knowledge'],
                ['Zero Trust', 'Governance'],
              ].map(([value, label]) => (
                <div key={value}>
                  <div className="text-sm font-bold text-white sm:text-base">{value}</div>
                  <div className="mt-1 text-[9px] uppercase tracking-[0.18em] text-blue-100/42 sm:text-[10px]">{label}</div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.75, delay: 0.12 }}
            className="relative mx-auto w-full max-w-[720px]"
          >
            <div className="absolute -inset-10 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="d3-chrome-panel relative overflow-visible rounded-[32px] p-4 sm:p-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-200/55">D3VONN Command Interface</p>
                  <p className="mt-1 text-sm font-semibold text-white">Enterprise Intelligence Core</p>
                </div>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-emerald-300/80">
                  <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_currentColor]" />
                  Online
                </div>
              </div>

              <div className="grid gap-4 py-5 sm:grid-cols-[1.12fr_0.88fr]">
                <div className="relative aspect-[1376/768] w-full overflow-hidden rounded-3xl border border-blue-200/10 bg-[#020b1c] sm:aspect-auto sm:min-h-[430px]">
                  <img
                    src={ENTERPRISE_CORE_SRC}
                    alt="D3VONN.IO Enterprise Intelligence Core — AI workforce, domain intelligence, and knowledge graph command center"
                    className="absolute inset-0 h-full w-full object-contain object-center p-2 sm:p-3"
                    loading="eager"
                    decoding="async"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#020b1c]/85 via-[#020b1c]/30 to-[#020b1c]/60" />

                  <span className="absolute left-4 top-4 z-10 rounded-full border border-blue-200/25 bg-[#020b1c]/80 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-blue-100/85 backdrop-blur-sm">Core 01</span>
                  <span className="absolute bottom-4 right-4 z-10 rounded-full border border-blue-200/25 bg-[#020b1c]/80 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-blue-100/85 backdrop-blur-sm">Hermes linked</span>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
                  {coreModules.map(({ label, value, icon: Icon, to }) => (
                    <Link
                      key={label}
                      to={to}
                      className="group rounded-2xl border border-blue-200/12 bg-[#03132d]/72 p-4 transition hover:-translate-y-0.5 hover:border-blue-300/35 hover:bg-blue-500/10"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <Icon className="h-5 w-5 text-blue-200" />
                        <ArrowRight className="h-4 w-4 text-blue-300/35 transition group-hover:translate-x-1 group-hover:text-blue-200" />
                      </div>
                      <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.17em] text-blue-100/50">{label}</p>
                      <p className="mt-1 text-xl font-black text-white">{value}</p>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-3">
                {[
                  ['Policy engine', 'Enforced'],
                  ['Knowledge graph', 'Synced'],
                  ['Agent runtime', 'Ready'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-white/8 bg-black/20 px-4 py-3">
                    <p className="text-[9px] uppercase tracking-[0.16em] text-blue-100/40">{label}</p>
                    <p className="mt-1 text-sm font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const CapabilitiesSection: React.FC = () => {
  const capabilities = [
    {
      icon: Bot,
      title: 'AI Workforce',
      description: 'Deploy specialized agents that plan, execute, collaborate, and report through governed business workflows.',
      to: '/agents',
    },
    {
      icon: Workflow,
      title: 'Automation Engine',
      description: 'Turn complex operating procedures into reusable, observable, and policy-aware workflow systems.',
      to: '/workflows',
    },
    {
      icon: Network,
      title: 'DKOS Knowledge',
      description: 'Ingest documents, map relationships, detect gaps, and give every agent access to trusted organizational knowledge.',
      to: '/dkos-ingestion',
    },
    {
      icon: ShieldCheck,
      title: 'Governance & Security',
      description: 'Operate with zero-trust controls, human approval gates, audit trails, and enterprise policy enforcement.',
      to: '/security',
    },
    {
      icon: Command,
      title: 'Operator Command Center',
      description: 'Observe system health, active missions, agent performance, deployment status, and business intelligence in real time.',
      to: '/occ',
    },
    {
      icon: Globe2,
      title: 'Enterprise Platform',
      description: 'Connect APIs, cloud systems, edge infrastructure, customer operations, and global business units from one control plane.',
      to: '/solutions',
    },
  ];

  return (
    <section id="platform" className="relative scroll-mt-20 overflow-hidden bg-[#020817] py-24 sm:py-32">
      <BinaryRain />
      <div className="container mx-auto px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-300/65">One governed intelligence layer</p>
          <h2 className="mt-5 text-balance text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
            Everything your intelligent business needs to operate.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-blue-50/60">
            D3VONN.IO unifies agents, knowledge, workflows, infrastructure, and governance so intelligence becomes an operating capability—not another disconnected tool.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {capabilities.map(({ icon: Icon, title, description, to }) => (
            <Link key={title} to={to} className="group">
              <GlassCard className="h-full min-h-[250px]">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-blue-200/15 bg-blue-400/10">
                  <Icon className="h-6 w-6 text-blue-200" />
                </div>
                <h3 className="mt-8 text-2xl font-black text-white">{title}</h3>
                <p className="mt-4 leading-7 text-blue-50/58">{description}</p>
                <div className="mt-8 flex items-center gap-2 text-sm font-semibold text-blue-200">
                  Explore capability
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

const IntelligenceStackSection: React.FC = () => {
  const stack = [
    { icon: Cpu, label: 'Hermes', value: 'Orchestration authority', detail: 'Plans, routes, executes, and coordinates intelligent work.' },
    { icon: Database, label: 'DKOS', value: 'Knowledge operating system', detail: 'Transforms documents and operational data into connected intelligence.' },
    { icon: Lock, label: 'Guardian', value: 'Zero-trust control', detail: 'Applies policy, approvals, isolation, and auditability at every layer.' },
    { icon: Terminal, label: 'Runtime', value: 'Execution fabric', detail: 'Connects cloud APIs, local infrastructure, edge devices, and business tools.' },
  ];

  return (
    <section className="bg-[#010611] py-24 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-300/65">The D3 intelligence stack</p>
            <h2 className="mt-5 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">
              Built like an operating system, not a chatbot.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-blue-50/58">
              Every layer has a clear responsibility: orchestration, knowledge, governance, and execution. Together they form a resilient intelligence infrastructure for real business operations.
            </p>
            <Link
              to="/documentation"
              className="mt-9 inline-flex items-center gap-2 rounded-xl border border-blue-300/20 bg-blue-400/10 px-5 py-3 font-semibold text-blue-100 transition hover:border-blue-300/45 hover:bg-blue-400/15"
            >
              View architecture
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-4">
            {stack.map(({ icon: Icon, label, value, detail }, index) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: 18 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.45, delay: index * 0.08 }}
                className="grid gap-5 rounded-2xl border border-blue-200/12 bg-blue-400/[0.035] p-5 backdrop-blur-xl sm:grid-cols-[auto_1fr_auto] sm:items-center"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-blue-200/15 bg-blue-400/10">
                  <Icon className="h-6 w-6 text-blue-200" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-200/50">{label}</p>
                  <p className="mt-1 text-xl font-bold text-white">{value}</p>
                  <p className="mt-2 text-sm leading-6 text-blue-50/52">{detail}</p>
                </div>
                <div className="hidden text-4xl font-black text-blue-300/10 sm:block">0{index + 1}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const ProductSection: React.FC = () => {
  const products = [
    { icon: Users, title: 'AI Workforce', text: 'Build and manage specialized agents.', to: '/ai-agents' },
    { icon: Settings, title: 'Business Automation', text: 'Automate repeatable operational work.', to: '/business-automation' },
    { icon: ShoppingCart, title: 'Agent Marketplace', text: 'Discover reusable capabilities and tools.', to: '/marketplace' },
    { icon: Clapperboard, title: 'AI Film Studio', text: 'Create cinematic media with intelligent workflows.', to: '/film' },
    { icon: BookOpen, title: 'Documentation', text: 'Understand the platform and architecture.', to: '/documentation' },
    { icon: Building2, title: 'Enterprise Solutions', text: 'Deploy governed intelligence across organizations.', to: '/solutions' },
  ];

  return (
    <section className="relative overflow-hidden bg-[#020817] py-24 sm:py-32">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/35 to-transparent" />
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-300/65">Explore the platform</p>
            <h2 className="mt-5 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">
              One platform. Multiple operating surfaces.
            </h2>
          </div>
          <Link to="/solutions" className="inline-flex items-center gap-2 font-semibold text-blue-200 transition hover:text-white">
            View all solutions
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.map(({ icon: Icon, title, text, to }) => (
            <Link
              key={title}
              to={to}
              className="group flex min-h-[170px] flex-col justify-between rounded-2xl border border-blue-200/12 bg-[#03132d]/52 p-6 transition hover:-translate-y-1 hover:border-blue-300/35 hover:bg-blue-500/8"
            >
              <div className="flex items-center justify-between gap-4">
                <Icon className="h-6 w-6 text-blue-200" />
                <ArrowRight className="h-4 w-4 text-blue-300/30 transition group-hover:translate-x-1 group-hover:text-blue-200" />
              </div>
              <div className="mt-8">
                <h3 className="text-xl font-bold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-blue-50/50">{text}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

const LiveIntelligenceSection: React.FC = () => (
  <section className="bg-[#010611] py-24 sm:py-32">
    <div className="container mx-auto px-4 sm:px-6">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-300/65">Live system demonstrations</p>
        <h2 className="mt-5 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">
          See the intelligence layer working.
        </h2>
        <p className="mt-6 text-lg leading-8 text-blue-50/58">
          Explore orchestration, knowledge, marketplace, and trust surfaces through live platform previews.
        </p>
      </div>

      <div className="mt-14 grid gap-5 xl:grid-cols-2">
        <Suspense fallback={<GlassCard className="min-h-[360px] animate-pulse" />}>
          <HermesOrchestrationDemo />
        </Suspense>
        <Suspense fallback={<GlassCard className="min-h-[360px] animate-pulse" />}>
          <KnowledgeGraphPreview />
        </Suspense>
        <Suspense fallback={<GlassCard className="min-h-[360px] animate-pulse" />}>
          <MarketplacePreview />
        </Suspense>
        <Suspense fallback={<GlassCard className="min-h-[360px] animate-pulse" />}>
          <TrustCenterPreview />
        </Suspense>
      </div>
    </div>
  </section>
);

const CTASection: React.FC = () => (
  <section className="relative overflow-hidden bg-[#020817] py-24 sm:py-32">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(37,126,255,0.17),transparent_44%)]" />
    <div className="container relative mx-auto px-4 sm:px-6">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[32px] border border-blue-300/18 bg-[linear-gradient(145deg,rgba(8,28,65,0.94),rgba(2,9,24,0.96))] px-6 py-14 text-center shadow-[0_0_90px_-25px_rgba(37,126,255,0.6)] sm:px-12 sm:py-20">
        <RadioTower className="mx-auto h-10 w-10 text-blue-200" />
        <h2 className="mx-auto mt-7 max-w-3xl text-balance text-4xl font-black tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl">
          Put your intelligence under command.
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-blue-50/58">
          Build an AI workforce, connect your knowledge, automate operations, and govern every action from one enterprise operating system.
        </p>
        <HomepageCTAGroup className="mt-9 justify-center" />
      </div>
    </div>
  </section>
);

const Index: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 90, damping: 26, restDelta: 0.001 });

  return (
    <HomepageShell>
      <Helmet>
        <title>D3VONN.IO — One Platform. Infinite Intelligence.</title>
        <meta
          name="description"
          content="D3VONN.IO is the AI Business Operating System for orchestrating intelligent agents, knowledge, workflows, security, and enterprise operations from one governed platform."
        />
        <link rel="canonical" href="https://d3vonn.io/" />
      </Helmet>

      <motion.div
        className="fixed left-0 right-0 top-0 z-[90] h-[2px] origin-left bg-gradient-to-r from-blue-500 via-cyan-300 to-blue-400"
        style={{ scaleX }}
      />

      <div>
        <Hero />
        <CapabilitiesSection />
        <IntelligenceStackSection />
        <ProductSection />
        <PlatformVideosSection />
        <LiveIntelligenceSection />
        <CTASection />
      </div>
    </HomepageShell>
  );
};

export default Index;
