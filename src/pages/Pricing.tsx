import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ShieldCheck } from 'lucide-react';
import ReaddyMarketingHero from '@/components/marketing/ReaddyMarketingHero';
import ReaddyMarketingShell from '@/components/marketing/ReaddyMarketingShell';

const plans = [
  {
    name: 'Starter',
    price: '$0',
    period: 'forever',
    desc: 'Explore AI agents and basic workflows.',
    features: ['3 active agents', 'Community marketplace', 'Basic observability', 'Starter workflow templates'],
    cta: 'Start free',
    href: '/login',
  },
  {
    name: 'Operator',
    price: '$49',
    period: 'per month',
    desc: 'Run a practical AI workforce for real business tasks.',
    features: ['Unlimited agents', 'Hermes mesh access', 'RAG knowledge vault', 'Priority support', 'Production workflow runs'],
    cta: 'Launch Operator',
    href: '/login',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'annual contract',
    desc: 'For teams needing governance, custom integrations, and deployment flexibility.',
    features: ['SSO/RBAC roadmap', 'Security review support', 'Dedicated implementation', 'Private/VPC deployment path', 'Custom agent bundles'],
    cta: 'Schedule demo',
    href: '/contact?inquiry=enterprise-demo',
  },
];

const Pricing: React.FC = () => {
  const title = 'Pricing — D3VONN.IO';
  const description = 'D3VONN.IO pricing for Starter, Operator, and Enterprise AI workforce orchestration plans.';

  return (
    <ReaddyMarketingShell>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href="https://d3vonn.io/pricing" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
      </Helmet>

      <main>
        <ReaddyMarketingHero
          eyebrow="Pricing"
          title={
            <>
              Clear pricing for building your{' '}
              <span className="bg-gradient-to-r from-blue-100 via-blue-300 to-cyan-300 bg-clip-text text-transparent">
                AI workforce.
              </span>
            </>
          }
          description="Start small, prove one workflow, then scale into a governed AI operating layer for your business."
        />

        <section className="px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`relative rounded-[28px] border p-7 transition hover:-translate-y-1 ${
                  plan.featured
                    ? 'border-blue-300/35 bg-blue-400/[0.065] shadow-[0_24px_90px_rgba(37,126,255,0.18)]'
                    : 'border-white/[0.08] bg-white/[0.025] hover:border-blue-300/22 hover:bg-blue-400/[0.04]'
                }`}
              >
                {plan.featured ? (
                  <div className="absolute -top-3 left-6 rounded-full border border-blue-200/20 bg-blue-700 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-[0_0_24px_rgba(37,126,255,0.35)]">
                    Most popular
                  </div>
                ) : null}
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200/55">{plan.name}</p>
                <p className="mt-5 text-sm leading-6 text-white/48">{plan.desc}</p>
                <div className="mt-7 flex items-end gap-2">
                  <span className="text-5xl font-black tracking-[-0.04em] text-white">{plan.price}</span>
                  <span className="pb-1 text-xs uppercase tracking-[0.12em] text-white/35">{plan.period}</span>
                </div>
                <div className="my-7 h-px bg-white/[0.08]" />
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-3 text-sm text-white/60">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  to={plan.href}
                  className={`mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition ${
                    plan.featured
                      ? 'bg-blue-700 text-white hover:bg-blue-600'
                      : 'border border-blue-200/20 bg-white/[0.035] text-blue-50 hover:border-blue-200/35 hover:bg-blue-300/[0.07]'
                  }`}
                >
                  {plan.cta} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-white/[0.07] bg-white/[0.018] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.025] p-3">
              <img
                src="/illustrations/agent-orchestration.svg"
                alt="What every plan runs on: the Hermes-orchestrated D3VONN.IO agent swarm with memory, safety, workflows, and knowledge"
                className="h-auto w-full rounded-[20px]"
                loading="lazy"
              />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-200/60">Every plan runs on D3VONN</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">One operating model from first agent to enterprise workforce.</h2>
              <p className="mt-5 text-base leading-7 text-white/50">
                Plans scale access and support, not the core control model. Hermes orchestration, governed workflows, knowledge grounding, and human oversight remain the architectural foundation.
              </p>
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-5xl rounded-[32px] border border-blue-300/15 bg-blue-400/[0.035] p-8 text-center sm:p-10">
            <ShieldCheck className="mx-auto h-10 w-10 text-blue-200" aria-hidden="true" />
            <h2 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">Enterprise pilots should start with one measurable workflow.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/50 sm:text-base">
              Choose a repeatable workflow with clear time savings, visible output quality, and measurable human approval points. Prove the operating model before expanding scope.
            </p>
            <Link
              to="/contact?inquiry=enterprise-demo"
              className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 text-sm font-semibold text-white transition hover:bg-blue-600"
            >
              Plan an enterprise pilot <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
    </ReaddyMarketingShell>
  );
};

export default Pricing;
