import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  FileText,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import ReaddyMarketingHero from '@/components/marketing/ReaddyMarketingHero';
import ReaddyMarketingShell from '@/components/marketing/ReaddyMarketingShell';

const solutions = [
  {
    icon: BriefcaseBusiness,
    title: 'Executive operations',
    body: 'Turn goals into task plans, briefs, follow-ups, and operating rhythms led by Hermes.',
  },
  {
    icon: Workflow,
    title: 'Workflow automation',
    body: 'Coordinate multi-step business processes with agents, approvals, and observable task states.',
  },
  {
    icon: BarChart3,
    title: 'Sales and market intelligence',
    body: 'Generate pipeline research, competitor maps, outreach assets, and executive summaries.',
  },
  {
    icon: FileText,
    title: 'Content and document production',
    body: 'Create reports, strategy docs, campaign assets, and knowledge-base updates from one command layer.',
  },
  {
    icon: ShieldCheck,
    title: 'Governed AI operations',
    body: 'Keep humans in control with supervision, visibility, run logs, and approval checkpoints.',
  },
  {
    icon: Bot,
    title: 'Custom AI workforce',
    body: 'Package specialized agents for departments, teams, clients, and repeatable operating playbooks.',
  },
];

const Solutions: React.FC = () => {
  const title = 'AI Business Solutions — D3VONN.IO';
  const description =
    'D3VONN.IO solutions for executive operations, workflow automation, sales intelligence, governed AI operations, and custom AI workforces.';

  return (
    <ReaddyMarketingShell>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href="https://d3vonn.io/solutions" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
      </Helmet>

      <main>
        <ReaddyMarketingHero
          eyebrow="Solutions"
          title={
            <>
              Practical AI workforce use cases for{' '}
              <span className="bg-gradient-to-r from-blue-100 via-blue-300 to-cyan-300 bg-clip-text text-transparent">
                real business execution.
              </span>
            </>
          }
          description="D3VONN.IO moves beyond chat into supervised work: planning, executing, monitoring, and improving business operations from one governed command layer."
        >
          <Link
            to="/contact?inquiry=pilot"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 text-sm font-semibold text-white shadow-[0_0_36px_rgba(37,126,255,0.32)] transition hover:bg-blue-600"
          >
            Plan a pilot <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            to="/marketplace"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-blue-200/20 bg-white/[0.035] px-6 text-sm font-semibold text-blue-50 transition hover:border-blue-200/35 hover:bg-blue-300/[0.07]"
          >
            Explore agents
          </Link>
        </ReaddyMarketingHero>

        <section className="px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="d3-chrome-panel mx-auto max-w-5xl overflow-hidden rounded-[32px] border border-blue-300/15 p-3 shadow-[0_30px_100px_rgba(0,22,70,0.35)] sm:p-5">
              <img
                src="/illustrations/agent-orchestration.svg"
                alt="Hermes orchestrating the D3VONN.IO agent swarm — TARS research, ION execution, SAPPHIRE memory, GUARDIAN safety, workflows, and the RAG knowledge vault"
                className="h-auto w-full rounded-[24px]"
                loading="lazy"
              />
            </div>

            <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {solutions.map(({ icon: Icon, title: itemTitle, body }) => (
                <article
                  key={itemTitle}
                  className="rounded-[24px] border border-white/[0.08] bg-white/[0.025] p-6 transition hover:-translate-y-0.5 hover:border-blue-300/22 hover:bg-blue-400/[0.04]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-300/20 bg-blue-400/[0.08] text-blue-200">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h2 className="mt-5 text-lg font-bold text-white">{itemTitle}</h2>
                  <p className="mt-3 text-sm leading-6 text-white/46">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-white/[0.07] bg-white/[0.018] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-200/60">Execution model</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">From business goal to governed outcome.</h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-white/50">
                Hermes turns intent into a task plan, routes work to specialized agents, pauses consequential actions for approval, and reports measurable outcomes back through the operating layer.
              </p>
            </div>
            <div className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.025] p-3">
              <img
                src="/illustrations/workflow-pipeline.svg"
                alt="D3VONN.IO workflow pipeline: business goal to Hermes task plan to governed agent execution to measured outcome"
                className="h-auto w-full rounded-[20px]"
                loading="lazy"
              />
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-5xl rounded-[32px] border border-blue-300/15 bg-blue-400/[0.035] p-8 text-center sm:p-10">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-200/60">Best next pilot</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Start with one high-value repeatable workflow.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/50 sm:text-base">
              Sales research, client onboarding, content production, executive reporting, and operations triage are strong first candidates because success can be measured clearly.
            </p>
            <Link
              to="/contact?inquiry=pilot"
              className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 text-sm font-semibold text-white transition hover:bg-blue-600"
            >
              Design the pilot <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
    </ReaddyMarketingShell>
  );
};

export default Solutions;
