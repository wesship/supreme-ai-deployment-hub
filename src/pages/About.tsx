import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { BrainCircuit, Eye, Network, ShieldCheck } from 'lucide-react';
import Container from '@/components/Container';
import SectionHeading from '@/components/SectionHeading';
import { Card, CardContent } from '@/components/ui/card';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';

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

const About: React.FC = () => (
  <>
    <D3vonnPageBanner title="About D3VONN.IO" />
    <Helmet>
      <title>About D3VONN.IO</title>
      <meta
        name="description"
        content="Learn why D3VONN.IO is being built as a governed AI Business Operating System for supervised agent execution."
      />
      <link rel="canonical" href="https://d3vonn.io/about" />
    </Helmet>

    <Container>
      <SectionHeading subheading="A governed operating system for intelligent business execution">
        Why D3VONN.IO exists
      </SectionHeading>

      <div className="grid items-center gap-12 py-10 lg:grid-cols-[0.9fr_1.1fr]">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-lg leading-8 text-muted-foreground">
            D3VONN.IO is being built to move AI beyond conversation and into supervised work. The platform brings together Hermes orchestration, specialized agents, knowledge, workflows, security controls, and human approvals in one command layer.
          </p>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            The goal is practical: help organizations turn business intent into visible, repeatable, and accountable execution without giving up human control.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="overflow-hidden rounded-3xl border border-blue-500/20 bg-blue-950/10"
        >
          <img
            src="/illustrations/governed-operations.svg"
            alt="D3VONN.IO supervised-autonomy model showing consequential agent actions passing through a human approval checkpoint"
            className="h-auto w-full"
            loading="lazy"
          />
        </motion.div>
      </div>

      <section className="mx-auto max-w-4xl py-12" aria-labelledby="human-advantage-heading">
        <div className="rounded-3xl border border-primary/15 bg-primary/5 px-6 py-10 text-center shadow-sm sm:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">The Human Advantage</p>
          <h2 id="human-advantage-heading" className="mt-4 text-3xl font-black sm:text-4xl">
            Intelligence turns nature&apos;s strengths into possibility.
          </h2>
          <blockquote className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-muted-foreground sm:text-xl sm:leading-9">
            <p>A cheetah is faster. A gorilla is stronger. An eagle sees farther. A dog smells better. A whale survives where humans cannot.</p>
            <p className="mt-5">But humanity possesses something greater: the ability to understand nature, learn from it, recreate its strengths, and combine them into something entirely new.</p>
            <p className="mt-5">We may not be the strongest, fastest, or most naturally gifted species—but we are the species capable of turning understanding into possibility.</p>
            <footer className="mt-6 text-sm font-semibold uppercase tracking-wider text-foreground">— D3VONN.IO</footer>
          </blockquote>
        </div>
      </section>

      <section className="py-12" aria-labelledby="operating-principles-heading">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">Operating principles</p>
          <h2 id="operating-principles-heading" className="mt-4 text-3xl font-black sm:text-5xl">
            Autonomy where it helps. Control where it matters.
          </h2>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {principles.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="border-primary/10 bg-primary/5">
              <CardContent className="p-6">
                <Icon className="h-8 w-8 text-primary" aria-hidden="true" />
                <h3 className="mt-4 text-xl font-semibold">{title}</h3>
                <p className="mt-3 leading-7 text-muted-foreground">{body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </Container>
  </>
);

export default About;
