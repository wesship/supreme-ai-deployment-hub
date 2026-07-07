import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  Building2,
  CheckCircle2,
  Clapperboard,
  Database,
  Film,
  Gauge,
  GitBranch,
  HeartPulse,
  Landmark,
  LineChart,
  Lock,
  Megaphone,
  Play,
  RefreshCcw,
  Scale,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from 'lucide-react';

const Shell: React.FC<React.HTMLAttributes<HTMLElement>> = ({ className = '', children, ...rest }) => (
  <section {...rest} className={`relative overflow-hidden bg-[#031f4f] py-24 scroll-mt-24 ${className}`}>
    <div className="pointer-events-none absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_18%_20%,rgba(59,130,246,0.45),transparent_30%),radial-gradient(circle_at_82%_76%,rgba(14,165,233,0.3),transparent_34%)]" />
    <div className="container relative mx-auto px-6">{children}</div>
  </section>
);

const Glass: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...rest }) => (
  <div
    {...rest}
    className={`rounded-2xl border border-blue-200/15 bg-blue-400/[0.04] p-6 shadow-[0_0_50px_-18px_rgba(96,165,250,0.6)] backdrop-blur-xl transition hover:border-blue-200/35 hover:bg-blue-500/[0.07] ${className}`}
  >
    {children}
  </div>
);

const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">{children}</p>
);

const workforce = [
  ['Hermes', 'Orchestrator', 'Online', '3 queued', BrainCircuit],
  ['Scout', 'Research', 'Ready', '1 running', Bot],
  ['Builder', 'Implementation', 'Ready', '2 queued', GitBranch],
  ['Sentinel', 'Security', 'Watching', '0 alerts', ShieldCheck],
  ['Market', 'Growth', 'Active', '4 drafts', Megaphone],
  ['Compliance', 'Review', 'Reviewing', '2 checks', Scale],
  ['Video', 'Studio', 'Ready', '1 render', Film],
  ['Finance', 'Signals', 'Standby', '0 queued', LineChart],
];

export const AIWorkforceVisualization: React.FC = () => (
  <Shell id="ai-workforce-live">
    <div className="mx-auto max-w-3xl text-center">
      <Eyebrow>AI Workforce Visualization</Eyebrow>
      <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">Live-status agent cards for the operating floor</h2>
      <p className="mt-4 text-blue-100/72">A public-safe preview of how D3VONN.IO should present agent state, work queues, current tasks, and readiness without exposing private data.</p>
    </div>
    <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {workforce.map(([name, role, status, queue, Icon], index) => (
        <Glass key={name as string} className="group relative overflow-hidden p-5">
          <div className="absolute right-4 top-4 h-2 w-2 rounded-full bg-blue-200 shadow-[0_0_16px_rgba(147,197,253,0.9)]" />
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-300/30 bg-blue-500/18">
              {React.createElement(Icon as React.ElementType, { className: 'h-6 w-6 text-blue-100' })}
            </div>
            <span className="rounded-full border border-blue-200/20 bg-blue-300/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-blue-100/65">{status}</span>
          </div>
          <h3 className="mt-5 text-xl font-black text-white">{name}</h3>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-blue-100/55">{role}</p>
          <p className="mt-4 text-sm text-blue-100/68">{queue}</p>
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-blue-950/70">
            <div className="h-full rounded-full bg-blue-300 shadow-[0_0_12px_rgba(147,197,253,0.85)]" style={{ width: `${44 + index * 6}%` }} />
          </div>
        </Glass>
      ))}
    </div>
  </Shell>
);

const architecture = [
  ['User Intent', 'Business goal enters the system.', Users],
  ['Gateway', 'Routes authenticated requests and public-safe traffic.', Gauge],
  ['Hermes', 'Plans, assigns, pauses, retries, and governs.', BrainCircuit],
  ['Knowledge', 'RAG, memory, documents, and graph context.', Database],
  ['Workflow', 'DAG execution, tool routing, and checkpoints.', Workflow],
  ['Security', 'Audit logs, approvals, monitoring, and controls.', ShieldCheck],
];

export const InteractivePlatformArchitecture: React.FC = () => {
  const [active, setActive] = useState(2);
  const activeNode = architecture[active];
  const Icon = activeNode[2] as React.ElementType;

  return (
    <Shell id="interactive-architecture" className="bg-[#021b48]">
      <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div>
          <Eyebrow>Interactive Platform Architecture</Eyebrow>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">Clickable data-flow map from intent to governed execution</h2>
          <p className="mt-5 text-blue-100/72">This turns the architecture from a static diagram into a buyer-friendly command story. Each module can later connect to live product surfaces.</p>
          <Link to="/docs" className="mt-8 inline-flex items-center gap-2 rounded-xl border border-blue-200/25 bg-blue-300/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-300/15">
            View technical docs <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <Glass className="p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {architecture.map(([title, desc, NodeIcon], index) => (
              <button
                key={title as string}
                type="button"
                onClick={() => setActive(index)}
                className={`rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-200 ${index === active ? 'border-blue-200/55 bg-blue-500/20' : 'border-blue-200/12 bg-white/[0.03] hover:border-blue-200/35'}`}
              >
                {React.createElement(NodeIcon as React.ElementType, { className: 'h-5 w-5 text-blue-200' })}
                <h3 className="mt-3 text-sm font-bold text-white">{title}</h3>
                <p className="mt-2 text-xs text-blue-100/58">{desc}</p>
              </button>
            ))}
          </div>
          <div className="mt-5 rounded-2xl border border-blue-200/12 bg-slate-950/35 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-blue-300/30 bg-blue-500/18">
                <Icon className="h-6 w-6 text-blue-100" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-blue-100/55">Selected module</p>
                <h3 className="text-xl font-black text-white">{activeNode[0]}</h3>
              </div>
            </div>
            <p className="mt-4 text-sm text-blue-100/70">{activeNode[1]}</p>
          </div>
        </Glass>
      </div>
    </Shell>
  );
};

const useCases = [
  { icon: Landmark, title: 'Insurance Agency', challenge: 'Lead follow-up and client education are inconsistent.', flow: 'Hermes routes leads to CRM, voice, email, and compliance review.', outcome: 'Cleaner pipeline, faster follow-up, better supervision.' },
  { icon: HeartPulse, title: 'Healthcare Ops', challenge: 'Teams need documentation, intake, and workflow support.', flow: 'Agents draft SOPs, summarize records, and prepare task queues.', outcome: 'Reduced admin load with human review preserved.' },
  { icon: Scale, title: 'Legal / Compliance', challenge: 'Reviews require evidence, audit trails, and repeatability.', flow: 'Knowledge graph connects documents, obligations, and decisions.', outcome: 'Better traceability and consistent review packets.' },
  { icon: Building2, title: 'Enterprise Sales', challenge: 'Research, messaging, and demo prep are fragmented.', flow: 'Research, marketing, and builder agents produce campaign assets.', outcome: 'More prepared outreach and stronger buyer narratives.' },
];

export const CustomerUseCaseCarousel: React.FC = () => {
  const [active, setActive] = useState(0);
  const item = useCases[active];
  const Icon = item.icon;

  return (
    <Shell id="use-cases">
      <div className="mx-auto max-w-3xl text-center">
        <Eyebrow>Customer Use Cases</Eyebrow>
        <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">Show buyers exactly where the AI workforce fits</h2>
      </div>
      <div className="mt-14 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-3">
          {useCases.map((useCase, index) => (
            <button key={useCase.title} type="button" onClick={() => setActive(index)} className={`rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-200 ${index === active ? 'border-blue-200/55 bg-blue-500/20' : 'border-blue-200/12 bg-white/[0.03] hover:border-blue-200/35'}`}>
              <span className="flex items-center gap-3 text-sm font-bold text-white">{React.createElement(useCase.icon, { className: 'h-5 w-5 text-blue-200' })}{useCase.title}</span>
            </button>
          ))}
        </div>
        <Glass>
          <Icon className="h-10 w-10 text-blue-200" />
          <h3 className="mt-5 text-2xl font-black text-white">{item.title}</h3>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div><p className="text-xs uppercase tracking-[0.18em] text-blue-100/50">Challenge</p><p className="mt-2 text-sm text-blue-100/75">{item.challenge}</p></div>
            <div><p className="text-xs uppercase tracking-[0.18em] text-blue-100/50">AI Workflow</p><p className="mt-2 text-sm text-blue-100/75">{item.flow}</p></div>
            <div><p className="text-xs uppercase tracking-[0.18em] text-blue-100/50">Outcome</p><p className="mt-2 text-sm text-blue-100/75">{item.outcome}</p></div>
          </div>
        </Glass>
      </div>
    </Shell>
  );
};

const trust = [
  ['Public Status', 'Operational preview', Gauge],
  ['Audit Logs', 'Evidence-ready path', CheckCircle2],
  ['RBAC Path', 'Role-based roadmap', Lock],
  ['Human Approval', 'Critical actions gated', Users],
  ['Observability', 'Runs and health visible', LineChart],
  ['Secure Routing', 'Public/private boundary', ShieldCheck],
];

export const EnterpriseTrustBadges: React.FC = () => (
  <Shell id="trust-badges" className="bg-[#052f70]">
    <div className="mx-auto max-w-3xl text-center">
      <Eyebrow>Enterprise Trust Badges</Eyebrow>
      <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">Trust signals without unsupported certification claims</h2>
      <p className="mt-4 text-blue-100/72">These badges communicate maturity while keeping language accurate: roadmap-based, public-safe, and ready for enterprise pilots.</p>
    </div>
    <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {trust.map(([title, desc, Icon]) => (
        <Glass key={title as string} className="flex items-center gap-4">
          {React.createElement(Icon as React.ElementType, { className: 'h-6 w-6 text-blue-200' })}
          <div><h3 className="font-bold text-white">{title}</h3><p className="mt-1 text-sm text-blue-100/62">{desc}</p></div>
        </Glass>
      ))}
    </div>
  </Shell>
);

const moviePipeline = ['Script', 'Storyboard', 'Voice', 'Characters', 'Scenes', 'Edit', 'Publish'];

export const MovieStudioShowcase: React.FC = () => (
  <Shell id="movie-studio-showcase">
    <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
      <div>
        <Eyebrow>AI Movie Studio Showcase</Eyebrow>
        <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">Turn the creative engine into a visible flagship feature</h2>
        <p className="mt-5 text-blue-100/72">Show the production pipeline for story, voice, character consistency, shot generation, editing, and publishing with compressed posters or future video loops.</p>
        <Link to="/film" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-blue-600/85 px-5 py-3 text-sm font-semibold text-white shadow-[0_0_30px_rgba(56,136,255,0.42)] transition hover:scale-[1.02]">
          Open AI Movie Studio <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <Glass className="overflow-hidden p-0">
        <div className="relative aspect-video border-b border-blue-200/10 bg-[radial-gradient(circle_at_50%_40%,rgba(96,165,250,0.45),rgba(2,27,72,0.9)_60%)]">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-blue-200/35 bg-blue-500/20 shadow-[0_0_42px_rgba(96,165,250,0.55)]">
              <Play className="h-9 w-9 text-white" />
            </div>
          </div>
          <div className="absolute bottom-4 left-4 rounded-full border border-blue-200/20 bg-slate-950/45 px-3 py-1 text-xs uppercase tracking-[0.16em] text-blue-100">Poster Preview</div>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-7">
          {moviePipeline.map((stage, index) => (
            <div key={stage} className="rounded-xl border border-blue-200/12 bg-blue-950/25 p-3 text-center">
              <Clapperboard className="mx-auto h-4 w-4 text-blue-200" />
              <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.13em] text-blue-100/70">{index + 1}. {stage}</p>
            </div>
          ))}
        </div>
      </Glass>
    </div>
  </Shell>
);

export const MotionPolishPanel: React.FC = () => {
  const items = useMemo(() => ['Reduced-motion safe', 'Lazy-load ready', 'Keyboard focus states', 'Hover micro-interactions', 'Mobile-first fallbacks'], []);
  return (
    <Shell id="motion-polish" className="bg-[#021b48]">
      <Glass className="mx-auto max-w-5xl text-center">
        <Sparkles className="mx-auto h-10 w-10 text-blue-200" />
        <h2 className="mt-5 text-3xl font-black text-white sm:text-5xl">Motion and performance polish checklist</h2>
        <p className="mx-auto mt-4 max-w-2xl text-blue-100/70">This section documents the final polish layer before Lighthouse and responsive QA.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {items.map((item) => <span key={item} className="rounded-full border border-blue-200/20 bg-blue-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-100/70">{item}</span>)}
        </div>
      </Glass>
    </Shell>
  );
};

const HomepageShowcaseSuite: React.FC = () => (
  <>
    <AIWorkforceVisualization />
    <InteractivePlatformArchitecture />
    <CustomerUseCaseCarousel />
    <EnterpriseTrustBadges />
    <MovieStudioShowcase />
    <MotionPolishPanel />
  </>
);

export default HomepageShowcaseSuite;
