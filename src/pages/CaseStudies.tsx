import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Bot, CheckCircle2, Workflow } from 'lucide-react';

const studies = [
  { title: 'Founder Command Center', icon: Bot, outcome: 'Turn scattered goals into visible agent tasks.', details: ['Hermes plans tasks and checkpoints', 'Command Center shows active work', 'Human approvals stay in the loop'] },
  { title: 'Research Operating Layer', icon: BarChart3, outcome: 'Produce structured briefs from internet, market, and lead research.', details: ['Reusable research workflows', 'RAG-backed context capture', 'Decision-ready summaries'] },
  { title: 'Workflow Automation Pilot', icon: Workflow, outcome: 'Package one repeated operation into a measurable workflow.', details: ['Define the goal', 'Assign agent roles', 'Measure cycle time and quality'] },
];

const CaseStudies: React.FC = () => {
  const title = 'Case Studies — D3VONN.IO';
  const description = 'D3VONN.IO case-study patterns for founder operations, research workflows, and measurable AI workforce pilots.';

  return (
    <div className="min-h-screen bg-[#020817] text-white">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href="https://d3vonn.io/case-studies" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
      </Helmet>
      <main className="container mx-auto px-6 py-24">
        <section className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">Case Studies</p>
          <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl">Pilot patterns for a <span className="text-blue-400">real AI workforce</span>.</h1>
          <p className="mt-6 text-lg text-white/70">Start with a measurable workflow, prove the value, then expand the Command Center into more business operations.</p>
        </section>
        <section className="mt-16 grid gap-6 lg:grid-cols-3">
          {studies.map((study) => (
            <article key={study.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_0_40px_-12px_rgba(56,136,255,0.25)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-blue-500/25 bg-blue-950/50 text-blue-300"><study.icon className="h-6 w-6" /></div>
              <h2 className="mt-5 text-2xl font-black">{study.title}</h2>
              <p className="mt-3 text-white/70">{study.outcome}</p>
              <ul className="mt-6 space-y-3">
                {study.details.map((detail) => <li key={detail} className="flex gap-3 text-sm text-white/70"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />{detail}</li>)}
              </ul>
            </article>
          ))}
        </section>
        <section className="mt-16 rounded-3xl border border-blue-500/20 bg-blue-950/20 p-8 text-center">
          <h2 className="text-3xl font-black">Build the next public case study.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-white/70">Pick one workflow with a clear input, output, approval point, and measurable business result.</p>
          <Link to="/contact?inquiry=case-study-pilot" className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-500">Plan a Pilot <ArrowRight className="h-4 w-4" /></Link>
        </section>
      </main>
    </div>
  );
};

export default CaseStudies;
