import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowRight, BriefcaseBusiness, Bot, Workflow, FileText, ShieldCheck, BarChart3 } from 'lucide-react';

const solutions = [
  { icon: BriefcaseBusiness, title: 'Executive operations', body: 'Turn goals into task plans, briefs, follow-ups, and operating rhythms led by Hermes.' },
  { icon: Workflow, title: 'Workflow automation', body: 'Coordinate multi-step business processes with agents, approvals, and observable task states.' },
  { icon: BarChart3, title: 'Sales and market intelligence', body: 'Generate pipeline research, competitor maps, outreach assets, and executive summaries.' },
  { icon: FileText, title: 'Content and document production', body: 'Create reports, strategy docs, campaign assets, and knowledge-base updates from one command layer.' },
  { icon: ShieldCheck, title: 'Governed AI operations', body: 'Keep humans in control with supervision, visibility, run logs, and approval checkpoints.' },
  { icon: Bot, title: 'Custom AI workforce', body: 'Package specialized agents for departments, teams, clients, and repeatable operating playbooks.' },
];

const Solutions: React.FC = () => {
  const title = 'AI Business Solutions — D3VONN.IO';
  const description = 'D3VONN.IO solutions for executive operations, workflow automation, sales intelligence, governed AI operations, and custom AI workforces.';

  return (
    <div className="min-h-screen bg-[#020817] text-white">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href="https://d3vonn.io/solutions" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
      </Helmet>

      <main className="container mx-auto px-6 py-24">
        <section className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">Solutions</p>
          <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl">
            Practical AI workforce use cases for <span className="text-blue-400">real business execution</span>.
          </h1>
          <p className="mt-6 text-lg text-white/70">
            D3VONN.IO is designed to move beyond chat into supervised work: planning, executing, monitoring, and improving business operations.
          </p>
        </section>

        <section className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {solutions.map((item) => (
            <article key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_0_40px_-12px_rgba(56,136,255,0.25)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-blue-500/25 bg-blue-950/50 text-blue-300">
                <item.icon className="h-6 w-6" />
              </div>
              <h2 className="mt-5 text-xl font-bold">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-white/65">{item.body}</p>
            </article>
          ))}
        </section>

        <section className="mt-20 rounded-3xl border border-blue-500/20 bg-blue-950/20 p-8 text-center">
          <h2 className="text-3xl font-black">Best next pilot</h2>
          <p className="mx-auto mt-3 max-w-2xl text-white/70">
            Start with one high-value repeatable workflow: sales research, client onboarding, content production, executive reporting, or operations triage.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <Link to="/contact?inquiry=pilot" className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-500">
              Plan a pilot <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/marketplace" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3 font-semibold text-white hover:bg-white/10">
              Explore agents
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Solutions;
