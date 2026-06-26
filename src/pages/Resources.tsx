import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { BookOpen, ShieldCheck, Activity, Network, Store, ArrowRight, FileText } from 'lucide-react';

const resources = [
  { icon: BookOpen, title: 'Documentation', body: 'Product docs, platform concepts, workflow setup, and implementation guidance.', href: '/documentation' },
  { icon: ShieldCheck, title: 'Security & Trust', body: 'Enterprise trust posture, control model, data boundaries, and compliance roadmap.', href: '/security' },
  { icon: Activity, title: 'System Status', body: 'Production status, health views, and operational readiness signals.', href: '/status' },
  { icon: Network, title: 'Architecture', body: 'How Hermes, agents, workflow engine, RAG, and Command Center fit together.', href: '/#architecture' },
  { icon: Store, title: 'Marketplace', body: 'Agent categories, reusable workforce templates, and deployment-ready AI workers.', href: '/marketplace' },
  { icon: FileText, title: 'Pilot Planning', body: 'Use-case framing for buyers, investors, and early enterprise pilots.', href: '/solutions' },
];

const Resources: React.FC = () => {
  const title = 'Resources — D3VONN.IO';
  const description = 'D3VONN.IO resources for documentation, security, status, architecture, marketplace, and enterprise AI workforce pilots.';

  return (
    <div className="min-h-screen bg-[#020817] text-white">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href="https://d3vonn.io/resources" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
      </Helmet>

      <main className="container mx-auto px-6 py-24">
        <section className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">Resources</p>
          <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl">
            The buyer, builder, and operator hub for <span className="text-blue-400">D3VONN.IO</span>.
          </h1>
          <p className="mt-6 text-lg text-white/70">
            Everything needed to understand, evaluate, pilot, and operate the AI Business Operating System.
          </p>
        </section>

        <section className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {resources.map((item) => (
            <Link key={item.title} to={item.href} className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_0_40px_-12px_rgba(56,136,255,0.25)] transition hover:-translate-y-0.5 hover:border-blue-500/40">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-blue-500/25 bg-blue-950/50 text-blue-300">
                <item.icon className="h-6 w-6" />
              </div>
              <h2 className="mt-5 text-xl font-bold">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-white/65">{item.body}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-300">
                Open resource <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
};

export default Resources;
