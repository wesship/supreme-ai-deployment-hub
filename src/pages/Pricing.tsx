import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ShieldCheck } from 'lucide-react';

const plans = [
  { name: 'Starter', price: '$0', period: 'forever', desc: 'Explore AI agents and basic workflows.', features: ['3 active agents', 'Community marketplace', 'Basic observability', 'Starter workflow templates'], cta: 'Start free', href: '/login' },
  { name: 'Operator', price: '$49', period: 'per month', desc: 'Run a practical AI workforce for real business tasks.', features: ['Unlimited agents', 'Hermes mesh access', 'RAG knowledge vault', 'Priority support', 'Production workflow runs'], cta: 'Launch Operator', href: '/login', featured: true },
  { name: 'Enterprise', price: 'Custom', period: 'annual contract', desc: 'For teams needing governance, custom integrations, and deployment flexibility.', features: ['SSO/RBAC roadmap', 'Security review support', 'Dedicated implementation', 'Private/VPC deployment path', 'Custom agent bundles'], cta: 'Schedule demo', href: '/contact?inquiry=enterprise-demo' },
];

const Pricing: React.FC = () => {
  const title = 'Pricing — D3VONN.IO';
  const description = 'D3VONN.IO pricing for Starter, Operator, and Enterprise AI workforce orchestration plans.';

  return (
    <div className="min-h-screen bg-[#020817] text-white">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href="https://d3vonn.io/pricing" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
      </Helmet>

      <main className="container mx-auto px-6 py-24">
        <section className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">Pricing</p>
          <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl">
            Clear pricing for building your <span className="text-blue-400">AI workforce</span>.
          </h1>
          <p className="mt-6 text-lg text-white/70">
            Start small, prove one workflow, then scale into a governed AI operating layer for your business.
          </p>
        </section>

        <section className="mt-16 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <article key={plan.name} className={`relative rounded-2xl border bg-white/[0.03] p-6 shadow-[0_0_40px_-12px_rgba(56,136,255,0.25)] ${plan.featured ? 'border-blue-500/50' : 'border-white/10'}`}>
              {plan.featured && <div className="absolute -top-3 left-6 rounded-full bg-blue-600 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest">Most popular</div>}
              <h2 className="text-2xl font-black">{plan.name}</h2>
              <p className="mt-3 text-sm text-white/65">{plan.desc}</p>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-5xl font-black">{plan.price}</span>
                <span className="text-sm text-white/50">{plan.period}</span>
              </div>
              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-3 text-sm text-white/75">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link to={plan.href} className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition ${plan.featured ? 'bg-blue-600 text-white hover:bg-blue-500' : 'border border-white/20 bg-white/5 text-white hover:bg-white/10'}`}>
                {plan.cta} <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </section>

        <section className="mt-16 rounded-3xl border border-blue-500/20 bg-blue-950/20 p-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-blue-300" />
          <h2 className="mt-4 text-3xl font-black">Enterprise pilots should start with one measurable workflow.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-white/70">
            The highest-value first pilot is usually a repeatable workflow with clear time savings, visible output quality, and measurable human approval points.
          </p>
        </section>
      </main>
    </div>
  );
};

export default Pricing;
