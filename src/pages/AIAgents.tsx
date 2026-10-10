import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Activity,
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  Command,
  Network,
  ShieldCheck,
  Sparkles,
  Workflow,
  Zap,
} from 'lucide-react';
import Footer from '@/components/Footer';
import SmartLaunchLink from '@/components/SmartLaunchLink';

const capabilities = [
  {
    icon: Brain,
    title: 'Reasoning that adapts',
    body: 'Agents plan, call tools, evaluate outcomes, and adjust execution without rigid scripts.',
  },
  {
    icon: Network,
    title: 'Multi-agent coordination',
    body: 'Specialized workers collaborate across research, operations, sales, support, and engineering.',
  },
  {
    icon: Workflow,
    title: 'Connected business execution',
    body: 'Agents operate through approved workflows, integrations, APIs, and MCP-enabled capabilities.',
  },
  {
    icon: ShieldCheck,
    title: 'Enterprise governance',
    body: 'Permissions, audit trails, credential controls, and human approval gates surround every run.',
  },
  {
    icon: Activity,
    title: 'Live operational visibility',
    body: 'Watch tasks, retries, escalations, service posture, and outcomes from one command layer.',
  },
  {
    icon: Zap,
    title: 'Reusable workforce templates',
    body: 'Launch proven agent roles, adapt them to your organization, and scale with repeatable controls.',
  },
];

const workforceRoles = [
  ['Research Analyst', 'Collects evidence, compares sources, and produces decision-ready intelligence.'],
  ['Sales Operator', 'Enriches leads, prepares outreach, updates pipeline context, and routes opportunities.'],
  ['Support Specialist', 'Triages requests, resolves routine issues, and escalates exceptions with full context.'],
  ['Operations Coordinator', 'Moves work across systems, validates completion, and surfaces blocked processes.'],
  ['Security Sentinel', 'Monitors risk signals, applies policy checks, and opens governed response workflows.'],
  ['Developer Agent', 'Assists with code, testing, deployment analysis, and infrastructure diagnostics.'],
];

const controlPoints = [
  'Human approval before high-impact actions',
  'Role-based access and tenant isolation',
  'Observable plans, tool calls, and outcomes',
  'Retry, recovery, and escalation policies',
  'Audit-ready execution history',
  'Centralized Command Center supervision',
];

const faqs = [
  {
    q: 'What is the D3VONN.IO AI Workforce?',
    a: 'It is a governed network of specialized AI agents that can plan, use approved tools, execute workflows, and collaborate under centralized human supervision.',
  },
  {
    q: 'How is this different from a chatbot?',
    a: 'A chatbot primarily responds to messages. D3VONN.IO agents can execute multi-step operational work, interact with connected systems, transfer tasks, and report outcomes through the Command Center.',
  },
  {
    q: 'Can people stay in control?',
    a: 'Yes. Approval gates, permissions, policies, audit trails, and escalation paths are core parts of the operating model rather than optional add-ons.',
  },
  {
    q: 'Can I start with one agent?',
    a: 'Yes. Start with one clearly scoped role, validate its workflow and controls, then expand into a coordinated workforce as operational confidence grows.',
  },
];

const AIAgents: React.FC = () => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#010611] text-white">
      <Helmet>
        <title>AI Workforce — Deploy Governed AI Agents | D3VONN.IO</title>
        <meta
          name="description"
          content="Build and supervise a governed AI workforce with multi-agent orchestration, enterprise controls, live execution visibility, and connected business workflows."
        />
        <link rel="canonical" href="https://d3vonn.io/ai-agents" />
        <meta property="og:title" content="AI Workforce | D3VONN.IO" />
        <meta property="og:description" content="Deploy specialized AI agents and govern their work from one enterprise command layer." />
        <meta property="og:url" content="https://d3vonn.io/ai-agents" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://d3vonn.io/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs.map((faq) => ({
            '@type': 'Question',
            name: faq.q,
            acceptedAnswer: { '@type': 'Answer', text: faq.a },
          })),
        })}</script>
      </Helmet>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_8%,rgba(37,126,255,0.18),transparent_31%),radial-gradient(circle_at_78%_22%,rgba(0,212,255,0.10),transparent_28%)]" />

      <section className="relative px-4 pb-20 pt-28 sm:px-6 lg:px-8 lg:pb-28 lg:pt-36">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-400/[0.07] px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-blue-200">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              EXU Workforce Intelligence
            </div>
            <h1 className="mt-7 max-w-4xl text-5xl font-black leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
              Build an AI workforce.
              <span className="mt-2 block bg-gradient-to-r from-white via-blue-100 to-blue-400 bg-clip-text text-transparent">
                Keep your business in command.
              </span>
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-7 text-white/58 sm:text-lg">
              Deploy specialized AI agents that research, coordinate, execute, and report across your organization—inside one governed operating system with human supervision built in.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <SmartLaunchLink
                authedTo="/app"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 text-sm font-semibold text-white shadow-[0_0_36px_rgba(37,126,255,0.38)] transition hover:bg-blue-600"
              >
                Launch your workforce <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </SmartLaunchLink>
              <Link
                to="/command-center"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-blue-200/20 bg-white/[0.035] px-6 text-sm font-semibold text-blue-50 transition hover:border-blue-200/35 hover:bg-blue-300/[0.07]"
              >
                <Command className="h-4 w-4" aria-hidden="true" />
                Open Command Center
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs text-white/42">
              {['Governed execution', 'Live supervision', 'Connected workflows'].map((item) => (
                <span key={item} className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300/80" aria-hidden="true" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-8 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="d3-chrome-panel relative overflow-hidden rounded-[32px] border border-blue-300/20 p-5 shadow-[0_30px_100px_rgba(0,22,70,0.45)] sm:p-7">
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-200/60">AI Workforce Command</p>
                  <h2 className="mt-2 text-xl font-bold">Live operating posture</h2>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_9px_currentColor]" />
                  Active
                </span>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  ['Agents', '12'],
                  ['Running', '08'],
                  ['Approvals', '03'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
                    <p className="text-2xl font-black text-white">{value}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/35">{label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-3">
                {[
                  ['Research Analyst', 'Competitive report', 'Running'],
                  ['Sales Operator', 'Lead enrichment', 'Review'],
                  ['Security Sentinel', 'Policy inspection', 'Healthy'],
                  ['Operations Coordinator', 'Vendor reconciliation', 'Queued'],
                ].map(([agent, task, state]) => (
                  <div key={agent} className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-300/20 bg-blue-400/[0.08] text-blue-200">
                      <Bot className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{agent}</p>
                      <p className="truncate text-xs text-white/38">{task}</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white/50">{state}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative border-y border-white/[0.07] bg-white/[0.018] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-200/60">Enterprise agent foundation</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">Everything required to operate AI agents responsibly.</h2>
            <p className="mt-5 text-base leading-7 text-white/50">D3VONN.IO combines execution, observability, orchestration, and governance so agent activity can become a dependable operating capability.</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {capabilities.map(({ icon: Icon, title, body }) => (
              <article key={title} className="rounded-[24px] border border-white/[0.08] bg-white/[0.025] p-6 transition hover:-translate-y-0.5 hover:border-blue-300/22 hover:bg-blue-400/[0.04]">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-300/20 bg-blue-400/[0.08] text-blue-200">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-5 text-lg font-bold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/46">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-200/60">Workforce roles</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">One workforce. Specialized intelligence.</h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/50">Create clearly bounded agent roles, connect them to approved systems, and coordinate work through shared goals and governed handoffs.</p>
            <Link to="/marketplace" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-blue-200 hover:text-white">
              Explore workforce templates <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {workforceRoles.map(([title, body], index) => (
              <div key={title} className="rounded-[22px] border border-white/[0.08] bg-white/[0.025] p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200/45">Role {String(index + 1).padStart(2, '0')}</span>
                  <Bot className="h-4 w-4 text-blue-200/55" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-base font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/44">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative px-4 pb-20 sm:px-6 lg:px-8 lg:pb-28">
        <div className="mx-auto grid max-w-7xl gap-8 rounded-[32px] border border-blue-300/15 bg-blue-400/[0.035] p-7 sm:p-10 lg:grid-cols-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-200/60">Human-centered governance</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Autonomy where it helps. Control where it matters.</h2>
            <p className="mt-5 text-sm leading-7 text-white/50">Every agent can be scoped by role, policy, data access, action authority, and approval requirements. D3VONN.IO is designed to make execution visible—not mysterious.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {controlPoints.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-black/15 p-4">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300/80" aria-hidden="true" />
                <span className="text-sm leading-6 text-white/58">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative px-4 pb-20 sm:px-6 lg:px-8 lg:pb-28">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-black tracking-tight sm:text-4xl">AI Workforce questions</h2>
          <div className="mt-8 space-y-3">
            {faqs.map(({ q, a }) => (
              <details key={q} className="group rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 open:border-blue-300/20 open:bg-blue-400/[0.04]">
                <summary className="cursor-pointer list-none text-base font-semibold text-white">{q}</summary>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-white/48">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="relative px-4 pb-24 sm:px-6 lg:px-8">
        <div className="d3-chrome-panel mx-auto max-w-5xl rounded-[32px] border border-blue-300/20 p-8 text-center sm:p-12">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-200/60">One Platform. Infinite Intelligence.</p>
          <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">Start with one role. Scale into an intelligent workforce.</h2>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/50">Launch D3VONN.IO, define a governed objective, and supervise your first agent from the Command Center.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <SmartLaunchLink authedTo="/app" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 text-sm font-semibold text-white shadow-[0_0_34px_rgba(37,126,255,0.38)] transition hover:bg-blue-600">
              Launch D3VONN.IO <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </SmartLaunchLink>
            <Link to="/contact" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/12 bg-white/[0.035] px-6 text-sm font-semibold text-white/75 transition hover:border-blue-300/25 hover:text-white">
              Plan your AI workforce
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default AIAgents;
