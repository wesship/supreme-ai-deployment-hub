import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, Bot, Brain, Network, Workflow, ShieldCheck, Zap } from 'lucide-react';
import Footer from '@/components/Footer';

const features = [
  {
    icon: Brain,
    title: 'Autonomous reasoning',
    body: 'ReAct-based agents that plan, call tools, observe results, and adapt — no rigid scripts.',
  },
  {
    icon: Network,
    title: 'Multi-agent orchestration',
    body: 'Coordinate dozens of specialized AI workers across research, ops, sales, and support.',
  },
  {
    icon: Workflow,
    title: 'MCP tool integration',
    body: 'Connect Hostinger, Vercel, AWS, GitHub, and any MCP server as agent capabilities.',
  },
  {
    icon: ShieldCheck,
    title: 'Enterprise governance',
    body: 'Row-level security, audit logs, and credential encryption baked into every agent run.',
  },
  {
    icon: Zap,
    title: 'Real-time execution',
    body: 'Live run streams, retries, and recovery — your AI workforce never stalls silently.',
  },
  {
    icon: Bot,
    title: 'Marketplace-ready',
    body: 'Deploy pre-built agent templates or publish your own to the D3VONN marketplace.',
  },
];

const useCases = [
  ['Sales & outreach', 'Prospect research, lead enrichment, and personalized outbound at scale.'],
  ['Customer support', '24/7 triage, ticket resolution, and intelligent escalation paths.'],
  ['Operations', 'Invoice processing, vendor reconciliation, and back-office automation.'],
  ['Research & analysis', 'Multi-source web research, competitive intel, and structured reports.'],
  ['DevOps & infra', 'Self-healing deployments via Wazuh, ServiceNow, and MCP-driven actions.'],
  ['Marketing', 'Content production, SEO research, and campaign orchestration.'],
];

const faqs = [
  {
    q: 'What is an AI agent?',
    a: 'An AI agent is an autonomous software worker that perceives its environment, reasons about goals, calls external tools, and takes actions on your behalf — without needing step-by-step prompts.',
  },
  {
    q: 'How is D3VONN different from a chatbot?',
    a: 'Chatbots respond to messages. D3VONN agents execute multi-step business workflows, integrate with your real systems via MCP, and run continuously inside an orchestrated AI workforce.',
  },
  {
    q: 'Can AI agents automate my entire business?',
    a: 'Yes — D3VONN is designed as a multi-agent business operating system, with specialized agents for sales, support, ops, research, and engineering all coordinated from one Command Center.',
  },
  {
    q: 'How do I deploy an AI agent?',
    a: 'Pick a template from the marketplace, configure credentials, and deploy in minutes. D3VONN handles secure execution, monitoring, and recovery automatically.',
  },
];

const AIAgents: React.FC = () => {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <Helmet>
        <title>AI Agents Platform — Build Your AI Workforce | D3VONN.IO</title>
        <meta
          name="description"
          content="Deploy autonomous AI agents that run your business. Multi-agent orchestration, MCP tool integration, and enterprise governance — all in one platform."
        />
        <link rel="canonical" href="https://d3vonn.io/ai-agents" />
        <meta property="og:title" content="AI Agents Platform — Build Your AI Workforce | D3VONN.IO" />
        <meta
          property="og:description"
          content="Autonomous AI agents that plan, reason, and execute real business work. Deploy your AI workforce in minutes."
        />
        <meta property="og:url" content="https://d3vonn.io/ai-agents" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://d3vonn.io/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="AI Agents Platform — D3VONN.IO" />
        <meta
          name="twitter:description"
          content="Autonomous AI agents that plan, reason, and execute real business work."
        />
        <meta name="twitter:image" content="https://d3vonn.io/og-image.png" />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs.map(f => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
          })),
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://d3vonn.io/' },
            { '@type': 'ListItem', position: 2, name: 'AI Agents', item: 'https://d3vonn.io/ai-agents' },
          ],
        })}</script>
      </Helmet>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-24 pb-20 md:pt-32">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(60% 50% at 50% 0%, rgba(112,128,255,0.25), transparent 70%)',
          }}
        />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-black/60 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-primary shadow-[0_0_18px_rgba(112,128,255,0.35)]">
            <Bot className="h-3 w-3" /> AI Agents Platform
          </div>
          <h1 className="mt-6 text-4xl font-bold leading-tight md:text-6xl">
            Build your <span className="text-primary">AI workforce</span>.
            <br />Run an autonomous business.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            D3VONN is the multi-agent business operating system. Deploy autonomous AI agents that
            plan, call tools, and execute real work across sales, support, ops, and engineering.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/app"
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_0_40px_-8px_rgba(112,128,255,0.8)] transition hover:brightness-110"
            >
              Launch D3VONN <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
            <Link
              to="/marketplace"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.03] px-6 py-3 text-sm font-semibold text-foreground backdrop-blur-xl transition hover:border-primary/40"
            >
              Browse Agent Marketplace
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold md:text-4xl">Built for autonomous AI agents</h2>
            <p className="mt-4 text-muted-foreground">
              Every primitive you need to deploy, govern, and scale an AI workforce in production.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, body }) => (
              <article
                key={title}
                className="group relative rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl transition-all duration-300 hover:border-primary/40 hover:-translate-y-0.5"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="relative px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold md:text-4xl">AI agents across every function</h2>
            <p className="mt-4 text-muted-foreground">
              From outbound sales to back-office ops — D3VONN agents replace repetitive work and
              augment your team.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {useCases.map(([title, body]) => (
              <div
                key={title}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-xl"
              >
                <h3 className="text-base font-semibold text-primary">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-bold md:text-4xl">Frequently asked questions</h2>
          <div className="mt-10 space-y-4">
            {faqs.map(({ q, a }) => (
              <details
                key={q}
                className="group rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl"
              >
                <summary className="cursor-pointer list-none text-base font-semibold text-foreground">
                  {q}
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-6 py-24">
        <div className="mx-auto max-w-3xl rounded-3xl border border-primary/30 bg-primary/5 p-10 text-center backdrop-blur-xl shadow-[0_0_60px_-10px_rgba(112,128,255,0.5)]">
          <h2 className="text-3xl font-bold md:text-4xl">Ready to deploy your AI workforce?</h2>
          <p className="mt-4 text-muted-foreground">
            Launch D3VONN and run your first autonomous agent in minutes.
          </p>
          <Link
            to="/app"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_0_40px_-8px_rgba(112,128,255,0.8)] transition hover:brightness-110"
          >
            Launch D3VONN <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default AIAgents;
