import React from 'react';
import { Helmet } from 'react-helmet-async';
import { BrainCircuit, Eye, Network, ShieldCheck } from 'lucide-react';
import ReaddyMarketingHero from '@/components/marketing/ReaddyMarketingHero';
import ReaddyMarketingShell from '@/components/marketing/ReaddyMarketingShell';

const principles = [
  {
    icon: BrainCircuit,
    title: 'Intelligence under command',
    body: 'D3VONN.IO coordinates agents, knowledge, workflows, and tools through a governed operating layer rather than an isolated chatbot.',
  },
  {
    icon: Eye,
    title: 'Visible execution',
    body: 'Plans, task states, approvals, retries, and outcomes are designed to remain observable to the people responsible for the work.',
  },
  {
    icon: ShieldCheck,
    title: 'Supervised autonomy',
    body: 'High-impact actions can pause for human review, while permissions and audit trails keep agent activity accountable.',
  },
  {
    icon: Network,
    title: 'Connected operations',
    body: 'Specialized agents can work across approved APIs, MCP tools, business systems, and organizational knowledge.',
  },
];

const About: React.FC = () => {
  const title = 'About D3VONN.IO';
  const description =
    'Learn why D3VONN.IO is being built as a governed AI Business Operating System for supervised agent execution.';

  return (
    <ReaddyMarketingShell>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href="https://d3vonn.io/about" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
      </Helmet>

      <main>
        <ReaddyMarketingHero
          eyebrow="About D3VONN.IO"
          title={
            <>
              A governed operating system for{' '}
              <span className="bg-gradient-to-r from-blue-100 via-blue-300 to-cyan-300 bg-clip-text text-transparent">
                intelligent business execution.
              </span>
            </>
          }
          description="D3VONN.IO is being built to move AI beyond conversation and into visible, repeatable, accountable work—without giving up human control."
        />

        <section className="px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-200/60">Why D3VONN exists</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">From AI assistance to supervised execution.</h2>
              <p className="mt-6 text-base leading-8 text-white/52">
                D3VONN.IO brings together Hermes orchestration, specialized agents, knowledge, workflows, security controls, and human approvals in one command layer.
              </p>
              <p className="mt-5 text-base leading-8 text-white/52">
                The goal is practical: help organizations turn business intent into visible, repeatable, and accountable execution while keeping people responsible for consequential decisions.
              </p>
            </div>

            <div className="d3-chrome-panel overflow-hidden rounded-[32px] border border-blue-300/15 p-3 shadow-[0_30px_100px_rgba(0,22,70,0.35)] sm:p-5">
              <img
                src="/illustrations/governed-operations.svg"
                alt="D3VONN.IO supervised-autonomy model showing consequential agent actions passing through a human approval checkpoint"
                className="h-auto w-full rounded-[24px]"
                loading="lazy"
              />
            </div>
          </div>
        </section>

        <section className="border-y border-white/[0.07] bg-white/[0.018] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl rounded-[32px] border border-blue-300/15 bg-blue-400/[0.035] px-6 py-10 text-center sm:px-10 sm:py-12">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-200/60">The Human Advantage</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Intelligence turns nature&apos;s strengths into possibility.</h2>
            <blockquote className="mx-auto mt-8 max-w-3xl text-base leading-8 text-white/52 sm:text-lg sm:leading-9">
              <p>A cheetah is faster. A gorilla is stronger. An eagle sees farther. A dog smells better. A whale survives where humans cannot.</p>
              <p className="mt-5">But humanity possesses something greater: the ability to understand nature, learn from it, recreate its strengths, and combine them into something entirely new.</p>
              <p className="mt-5">We may not be the strongest, fastest, or most naturally gifted species—but we are the species capable of turning understanding into possibility.</p>
              <footer className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-blue-200/70">— D3VONN.IO</footer>
            </blockquote>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 lg:px-8 lg:py-24" aria-labelledby="operating-principles-heading">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-200/60">Operating principles</p>
              <h2 id="operating-principles-heading" className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
                Autonomy where it helps. Control where it matters.
              </h2>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-2">
              {principles.map(({ icon: Icon, title: itemTitle, body }) => (
                <article
                  key={itemTitle}
                  className="rounded-[24px] border border-white/[0.08] bg-white/[0.025] p-6 transition hover:-translate-y-0.5 hover:border-blue-300/22 hover:bg-blue-400/[0.04]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-300/20 bg-blue-400/[0.08] text-blue-200">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-white">{itemTitle}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/46">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </ReaddyMarketingShell>
  );
};

export default About;
