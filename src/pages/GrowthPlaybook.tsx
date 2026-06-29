import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Bell, Bot, CheckCircle2, Gauge, Gift, HeartHandshake, Lock, MousePointerClick, Sparkles, Trophy, Users, Workflow } from 'lucide-react';

const cards = [
  ['Interactive sandbox', 'Let visitors launch a guided Hermes walkthrough before signup.', MousePointerClick],
  ['First automation before pricing', 'Ask what users want to automate, draft the workflow, then introduce the plan.', Workflow],
  ['Hermes onboarding guide', 'Use Hermes as the character guide for goals, agents, approvals, memory, and visibility.', Bot],
  ['ROI calculator', 'Estimate hours saved, workflow cost avoided, agent capacity, and upgrade value.', Gauge],
  ['3-day automation challenge', 'Guide new users through choosing, launching, and measuring one workflow.', Trophy],
  ['Notification timing', 'Ask for alerts only after the first successful run, tied to approvals and failures.', Bell],
  ['Referral loop', 'Reward invited builders and businesses with credits and marketplace discounts.', Gift],
  ['Template marketplace', 'Package sales, research, support, DevOps, compliance, content, and ops workflows.', Users],
  ['Offboarding recovery', 'Preserve workflows for 30 days, learn why users leave, and offer a return path.', HeartHandshake],
];

const competitors = ['Zapier', 'n8n', 'Lindy', 'Relevance AI', 'CrewAI', 'Microsoft Copilot'];

const GrowthPlaybook: React.FC = () => (
  <main className="min-h-screen bg-[#031f4f] text-white">
    <section className="relative isolate overflow-hidden pt-28 pb-20">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#073878] via-[#052f70] to-[#021b48]" />
      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/35 bg-blue-500/10 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-blue-100 backdrop-blur">
            <Sparkles className="h-4 w-4" /> D3VONN.IO Growth System
          </div>
          <h1 className="mt-8 text-4xl font-black tracking-tight sm:text-6xl">Turn D3VONN.IO into a product-led growth engine.</h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg text-blue-100/78 sm:text-xl">A clean implementation map for guided demos, first automation, ROI proof, trust pages, marketplace loops, retention, referrals, and competitor positioning.</p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Link to="/command-center" className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600/90 px-7 py-4 font-semibold shadow-[0_0_40px_rgba(56,136,255,0.45)] transition hover:scale-[1.02]">Launch Command Center Demo <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/pricing" className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200/25 bg-blue-300/10 px-7 py-4 font-semibold transition hover:bg-blue-300/15">View Usage Plans</Link>
          </div>
        </div>
      </div>
    </section>

    <section className="py-20">
      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200/80">Implementation Matrix</p>
          <h2 className="mt-4 text-3xl font-black sm:text-5xl">Growth tactics mapped to product behavior.</h2>
        </div>
        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {cards.map(([title, body, Icon]) => (
            <div key={title as string} className="rounded-2xl border border-blue-200/15 bg-blue-300/[0.055] p-6 backdrop-blur-xl shadow-[0_0_44px_-16px_rgba(56,136,255,0.38)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-blue-200/25 bg-blue-500/20 text-blue-100"><Icon className="h-6 w-6" /></div>
              <h3 className="mt-5 text-xl font-bold">{title as string}</h3>
              <p className="mt-3 text-sm leading-6 text-blue-100/70">{body as string}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="border-y border-blue-200/12 bg-[#052f70]/60 py-20">
      <div className="container mx-auto grid gap-10 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200/80">Activation Funnel</p>
          <h2 className="mt-4 text-3xl font-black sm:text-5xl">Discover → Demo → ROI → First Automation → Upgrade.</h2>
          <p className="mt-5 text-blue-100/72">The strongest path is a supervised product experience that helps the user build one useful workflow before asking for a paid plan.</p>
        </div>
        <div className="rounded-2xl border border-blue-200/15 bg-blue-300/[0.055] p-6 backdrop-blur-xl">
          {['Choose business outcome', 'Hermes generates workflow plan', 'User approves first automation', 'ROI calculator shows savings', 'Upgrade prompt appears at usage limit'].map((step, index) => (
            <div key={step} className="flex gap-4 border-b border-blue-200/10 py-4 last:border-b-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-200/25 bg-blue-500/20 text-sm font-black">{index + 1}</div>
              <div><h3 className="font-semibold">{step}</h3><p className="mt-1 text-sm text-blue-100/58">Designed to reduce friction and increase product understanding.</p></div>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="py-20">
      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200/80">Competitive Positioning</p>
          <h2 className="mt-4 text-3xl font-black sm:text-5xl">Comparison pages to capture buying intent.</h2>
          <p className="mt-4 text-blue-100/72">Differentiate around orchestration, governance, knowledge, agent visibility, and enterprise control.</p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          {competitors.map((name) => (
            <div key={name} className="rounded-2xl border border-blue-200/15 bg-blue-300/[0.055] p-5">
              <div className="flex items-center justify-between gap-3"><h3 className="font-bold">D3VONN.IO vs {name}</h3><BarChart3 className="h-5 w-5 text-blue-200" /></div>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="pb-28">
      <div className="container mx-auto px-6">
        <div className="rounded-2xl border border-blue-200/15 bg-blue-300/[0.055] p-8 text-center backdrop-blur-xl">
          <Lock className="mx-auto h-8 w-8 text-blue-200" />
          <h2 className="mt-5 text-3xl font-black sm:text-5xl">Growth works when trust is visible.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-blue-100/72">Security, status, documentation, roadmap, case studies, and deployment proof should connect from every major conversion point.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm text-blue-100/80">
            {['/security', '/status', '/documentation', '/pricing'].map((path) => <Link key={path} to={path} className="inline-flex items-center gap-2 rounded-full border border-blue-200/20 bg-blue-300/10 px-4 py-2 hover:bg-blue-300/15"><CheckCircle2 className="h-4 w-4 text-blue-200" /> {path}</Link>)}
          </div>
        </div>
      </div>
    </section>
  </main>
);

export default GrowthPlaybook;
