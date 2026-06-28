import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Bell, Bot, CheckCircle2, Crown, Gauge, Gift, GraduationCap, HeartHandshake, LineChart, Lock, MousePointerClick, Rocket, ShieldCheck, Sparkles, Trophy, Users, Workflow } from 'lucide-react';

const GlassCard: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...rest }) => (
  <div
    {...rest}
    className={
      'relative rounded-2xl border border-blue-200/15 bg-blue-300/[0.055] p-6 backdrop-blur-xl ' +
      'shadow-[0_0_44px_-16px_rgba(56,136,255,0.38)] transition-all duration-300 ' +
      'hover:border-blue-200/35 hover:shadow-[0_0_70px_-14px_rgba(56,136,255,0.56)] ' +
      className
    }
  >
    {children}
  </div>
);

const Section: React.FC<React.HTMLAttributes<HTMLElement>> = ({ className = '', children, ...rest }) => (
  <section {...rest} className={'relative py-20 scroll-mt-24 ' + className}>
    <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_0%,rgba(29,142,255,0.16),transparent_40%)]" />
    <div className="container relative mx-auto px-6">{children}</div>
  </section>
);

const items = [
  { icon: MousePointerClick, title: 'Interactive sandbox', body: 'Let visitors launch a guided Hermes walkthrough before signup so they feel the product before seeing friction.' },
  { icon: Workflow, title: 'First automation before pricing', body: 'Ask what they want to automate, build a draft workflow, then introduce the right plan based on usage.' },
  { icon: Bot, title: 'Hermes onboarding guide', body: 'Use Hermes as the character guide that explains goals, agents, approvals, memory, and command-center visibility.' },
  { icon: LineChart, title: 'Before / after transformation', body: 'Show the old manual business process beside the D3VONN version with agents, checkpoints, and measurable outputs.' },
  { icon: Gauge, title: 'ROI calculator', body: 'Estimate hours saved, workflow cost avoided, agent capacity, and upgrade justification for every prospect.' },
  { icon: Trophy, title: '3-day automation challenge', body: 'Give new users a simple challenge: choose a process, launch one supervised workflow, and ship one measurable output.' },
  { icon: Crown, title: 'AI maturity score', body: 'Score users by deployed agents, integrations, workflows, knowledge-base depth, approvals, and observability readiness.' },
  { icon: Bell, title: 'Permission timing', body: 'Request notifications only after the first successful run, framed around failures, approvals, deployments, and task completion.' },
  { icon: ShieldCheck, title: 'Trust center path', body: 'Connect security, status, docs, roadmap, case studies, audit evidence, and SOC 2 readiness into one enterprise buying story.' },
  { icon: Gift, title: 'Referral loop', body: 'Reward invited operators, builders, and businesses with credits, marketplace discounts, and founder-tier access.' },
  { icon: Users, title: 'Template marketplace', body: 'Package workflows for sales, research, support, DevOps, compliance, content, and operations as one-click starts.' },
  { icon: HeartHandshake, title: 'Offboarding recovery', body: 'When users leave, preserve workflows for 30 days, collect the reason, and offer a lower-friction return path.' },
];

const competitors = ['Zapier', 'n8n', 'Lindy', 'Relevance AI', 'CrewAI', 'Microsoft Copilot'];

const GrowthPlaybook: React.FC = () => {
  return (
    <main className="min-h-screen bg-[#031f4f] text-white">
      <section className="relative isolate overflow-hidden pt-28 pb-20">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#073878] via-[#052f70] to-[#021b48]" />
        <div className="absolute inset-0 -z-10 opacity-20 bg-[linear-gradient(rgba(113,191,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(113,191,255,0.06)_1px,transparent_1px)] bg-[size:72px_72px]" />
        <div className="container mx-auto px-6">
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/35 bg-blue-500/10 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-blue-100 backdrop-blur">
              <Sparkles className="h-4 w-4" /> D3VONN.IO Growth System
            </div>
            <h1 className="mt-8 text-4xl font-black tracking-tight text-white sm:text-6xl">
              Turn the homepage into a product-led growth engine.
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg text-blue-100/78 sm:text-xl">
              This playbook operationalizes the full recommendation set: guided demos, first automation, ROI proof, trust pages, marketplace loops, retention, referrals, and competitor positioning.
            </p>
            <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
              <Link to="/command-center" className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600/90 px-7 py-4 font-semibold text-white shadow-[0_0_40px_rgba(56,136,255,0.45)] transition hover:scale-[1.02]">
                Launch Command Center Demo <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/pricing" className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200/25 bg-blue-300/10 px-7 py-4 font-semibold text-white transition hover:bg-blue-300/15">
                View Usage Plans
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Section>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200/80">Implementation Matrix</p>
          <h2 className="mt-4 text-3xl font-black sm:text-5xl">All growth recommendations mapped to product behavior.</h2>
        </div>
        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <GlassCard key={item.title} className="h-full">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-blue-200/25 bg-blue-500/20 text-blue-100">
                <item.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-blue-100/70">{item.body}</p>
            </GlassCard>
          ))}
        </div>
      </Section>

      <Section className="border-y border-blue-200/12 bg-[#052f70]/60">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200/80">Activation Funnel</p>
            <h2 className="mt-4 text-3xl font-black sm:text-5xl">Discover → Demo → ROI → First Automation → Upgrade.</h2>
            <p className="mt-5 text-blue-100/72">
              The strongest conversion path is not a hard paywall. It is a supervised product experience that creates commitment by helping the user build the first useful workflow before asking for a paid plan.
            </p>
          </div>
          <GlassCard>
            {['Choose business outcome', 'Hermes generates workflow plan', 'User approves first automation', 'ROI calculator shows savings', 'Upgrade prompt appears at usage limit'].map((step, index) => (
              <div key={step} className="flex gap-4 border-b border-blue-200/10 py-4 last:border-b-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-200/25 bg-blue-500/20 text-sm font-black text-blue-100">{index + 1}</div>
                <div>
                  <h3 className="font-semibold text-white">{step}</h3>
                  <p className="mt-1 text-sm text-blue-100/58">Designed to reduce friction while increasing product understanding.</p>
                </div>
              </div>
            ))}
          </GlassCard>
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200/80">Competitive Positioning</p>
          <h2 className="mt-4 text-3xl font-black sm:text-5xl">Comparison pages to capture buying intent.</h2>
          <p className="mt-4 text-blue-100/72">Create direct pages for the searches buyers already make, then differentiate around orchestration, governance, knowledge, agent visibility, and enterprise control.</p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          {competitors.map((name) => (
            <GlassCard key={name} className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-white">D3VONN.IO vs {name}</h3>
                  <p className="mt-2 text-sm text-blue-100/62">Position against workflow tools with AI command-center governance.</p>
                </div>
                <BarChart3 className="h-5 w-5 text-blue-200" />
              </div>
            </GlassCard>
          ))}
        </div>
      </Section>

      <Section className="pb-28">
        <GlassCard className="text-center">
          <Lock className="mx-auto h-8 w-8 text-blue-200" />
          <h2 className="mt-5 text-3xl font-black sm:text-5xl">Growth works when trust is visible.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-blue-100/72">Security, status, documentation, roadmap, case studies, and real deployment proof should be connected from every major conversion point.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm text-blue-100/80">
            {['/security', '/status', '/documentation', '/roadmap', '/case-studies'].map((path) => (
              <Link key={path} to={path} className="inline-flex items-center gap-2 rounded-full border border-blue-200/20 bg-blue-300/10 px-4 py-2 hover:bg-blue-300/15">
                <CheckCircle2 className="h-4 w-4 text-blue-200" /> {path}
              </Link>
            ))}
          </div>
        </GlassCard>
      </Section>
    </main>
  );
};

export default GrowthPlaybook;
