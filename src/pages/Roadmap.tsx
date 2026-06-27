import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock, Compass, Rocket } from 'lucide-react';

const roadmap = [
  { phase: 'Now', title: 'Production credibility layer', icon: CheckCircle2, items: ['Proof bar above the fold', 'Command Center demo route', 'Security, docs, status, roadmap, and case-study pages', 'Starter-to-Enterprise pricing ladder'] },
  { phase: 'Next', title: 'Pilot workflow packaging', icon: Rocket, items: ['Founder workflow templates', 'Sales, research, support, and DevOps agent bundles', 'Demo-to-signup funnel', 'Public pilot intake workflow'] },
  { phase: 'Soon', title: 'Enterprise trust maturity', icon: Clock, items: ['Audit log export', 'SSO and RBAC readiness', 'Security review packet', 'Compliance mapping for regulated pilots'] },
  { phase: 'Future', title: 'Business OS expansion', icon: Compass, items: ['Agent marketplace expansion', 'Private deployment path', 'Advanced memory governance', 'Cross-team Command Center workspaces'] },
];

const Roadmap: React.FC = () => {
  const title = 'Roadmap — D3VONN.IO';
  const description = 'D3VONN.IO roadmap for the AI Business Operating System, Command Center, Hermes orchestration, enterprise trust, and AI workforce expansion.';

  return (
    <div className="min-h-screen bg-[#020817] text-white">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href="https://d3vonn.io/roadmap" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
      </Helmet>
      <main className="container mx-auto px-6 py-24">
        <section className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">Roadmap</p>
          <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl">From production proof to <span className="text-blue-400">business OS</span>.</h1>
          <p className="mt-6 text-lg text-white/70">D3VONN.IO is moving from a verified AI operating layer into packaged pilots, trust maturity, and enterprise-grade multi-agent workspaces.</p>
        </section>
        <section className="mt-16 grid gap-6 lg:grid-cols-4">
          {roadmap.map((section) => (
            <article key={section.phase} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_0_40px_-12px_rgba(56,136,255,0.25)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-blue-500/25 bg-blue-950/50 text-blue-300"><section.icon className="h-6 w-6" /></div>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">{section.phase}</p>
              <h2 className="mt-2 text-xl font-black">{section.title}</h2>
              <ul className="mt-5 space-y-3">
                {section.items.map((item) => <li key={item} className="flex gap-3 text-sm text-white/70"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />{item}</li>)}
              </ul>
            </article>
          ))}
        </section>
        <section className="mt-16 rounded-3xl border border-blue-500/20 bg-blue-950/20 p-8 text-center">
          <h2 className="text-3xl font-black">Ready to see the command layer?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-white/70">Start with the public Command Center demo, then move into a measurable founder workflow pilot.</p>
          <Link to="/demo" className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-500">Launch Command Center Demo <ArrowRight className="h-4 w-4" /></Link>
        </section>
      </main>
    </div>
  );
};

export default Roadmap;
