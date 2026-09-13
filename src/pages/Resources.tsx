import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BookOpen,
  Download,
  Network,
  ShieldCheck,
  Store,
} from 'lucide-react';
import ReaddyMarketingHero from '@/components/marketing/ReaddyMarketingHero';
import ReaddyMarketingShell from '@/components/marketing/ReaddyMarketingShell';

const resources = [
  {
    icon: BookOpen,
    title: 'Documentation',
    body: 'Product docs, platform concepts, workflow setup, and implementation guidance.',
    href: '/documentation',
  },
  {
    icon: ShieldCheck,
    title: 'Security & Trust',
    body: 'Enterprise trust posture, control model, data boundaries, and compliance roadmap.',
    href: '/security',
  },
  {
    icon: Activity,
    title: 'System Status',
    body: 'Production status, health views, and operational readiness signals.',
    href: '/status',
  },
  {
    icon: Network,
    title: 'Architecture',
    body: 'How Hermes, agents, workflow engine, RAG, and Command Center fit together.',
    href: '/#architecture',
  },
  {
    icon: Store,
    title: 'Marketplace',
    body: 'Agent categories, reusable workforce templates, and deployment-ready AI workers.',
    href: '/marketplace',
  },
];

const videoLearning = [
  { category: 'Start Here', kind: 'External Explainer', title: 'What Are AI Agents?', body: 'A clear introduction to AI agents — the building blocks of the D3VONN workforce.', source: 'IBM Technology', href: 'https://www.youtube.com/results?search_query=IBM+Technology+What+Are+AI+Agents' },
  { category: 'AI Agents', kind: 'External Explainer', title: 'Multi-Agent Systems Explained', body: 'How specialized agents coordinate — the pattern Hermes uses instead of one general chatbot.', source: 'IBM Technology', href: 'https://www.youtube.com/results?search_query=IBM+Technology+Multi+Agent+Systems+Explained' },
  { category: 'Knowledge & RAG', kind: 'External Explainer', title: 'What Is Retrieval-Augmented Generation?', body: 'How agents ground their answers and actions in your knowledge before acting.', source: 'IBM Technology', href: 'https://www.youtube.com/results?search_query=IBM+Technology+What+is+Retrieval+Augmented+Generation' },
  { category: 'Knowledge & RAG', kind: 'External Explainer', title: 'What Is a Knowledge Graph?', body: 'The conceptual companion to the D3VONN knowledge graph and DKOS ingestion.', source: 'IBM Technology', href: 'https://www.youtube.com/results?search_query=IBM+Technology+What+is+a+Knowledge+Graph' },
  { category: 'MCP & Integrations', kind: 'Official Documentation', title: 'Model Context Protocol — Introduction', body: 'The official introduction to MCP, the open protocol behind the D3VONN Tool Explorer.', source: 'modelcontextprotocol.io', href: 'https://modelcontextprotocol.io/introduction' },
  { category: 'MCP & Integrations', kind: 'Official Documentation', title: 'Anthropic MCP Documentation', body: 'Reference documentation for connecting and governing MCP tools.', source: 'Anthropic', href: 'https://docs.claude.com/en/docs/mcp' },
  { category: 'Security & Governance', kind: 'External Explainer', title: 'Security Operations Center Explained', body: 'Background for the D3VONN Security Command Center and security operations views.', source: 'IBM Technology', href: 'https://www.youtube.com/results?search_query=IBM+Technology+Security+Operations+Center+Explained' },
  { category: 'Security & Governance', kind: 'External Explainer', title: 'The Importance of AI Governance', body: 'Why approvals, accountability, and supervised autonomy matter for enterprise AI.', source: 'IBM Technology', href: 'https://www.youtube.com/results?search_query=IBM+Technology+Importance+of+AI+Governance' },
  { category: 'Workflows', kind: 'External Tutorial', title: 'Build Your First AI Agent Workflow', body: 'A practical beginner walkthrough of agent automation patterns.', source: 'n8n', href: 'https://docs.n8n.io/advanced-ai/intro-tutorial/' },
  { category: 'Developer Platform', kind: 'External Tutorial', title: 'API Fundamentals — Postman 101', body: 'Free API learning material: requests, authentication, testing, and collections.', source: 'Postman Learning Center', href: 'https://learning.postman.com/' },
  { category: 'AI Film Studio', kind: 'External Tutorial', title: 'Runway Academy — AI Filmmaking', body: 'Free training on AI video generation and creative workflows for D3VONN Studios users.', source: 'Runway Academy', href: 'https://academy.runwayml.com/' },
  { category: 'Edge AI', kind: 'External Tutorial', title: 'NVIDIA Jetson AI Lab Tutorials', body: 'Official tutorials for local models, edge inference, and Jetson deployments.', source: 'NVIDIA', href: 'https://www.jetson-ai-lab.com/tutorials.html' },
];

const Resources: React.FC = () => {
  const title = 'Resources — D3VONN.IO';
  const description =
    'D3VONN.IO resources for documentation, security, status, architecture, marketplace, and enterprise AI workforce pilots.';

  return (
    <ReaddyMarketingShell>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href="https://d3vonn.io/resources" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
      </Helmet>

      <main>
        <ReaddyMarketingHero
          eyebrow="Resources"
          title={
            <>
              The buyer, builder, and operator hub for{' '}
              <span className="bg-gradient-to-r from-blue-100 via-blue-300 to-cyan-300 bg-clip-text text-transparent">
                D3VONN.IO.
              </span>
            </>
          }
          description="Everything needed to understand, evaluate, pilot, and operate the AI Business Operating System."
        />

        <section className="px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {resources.map(({ icon: Icon, title: itemTitle, body, href }) => (
              <Link
                key={itemTitle}
                to={href}
                className="group rounded-[24px] border border-white/[0.08] bg-white/[0.025] p-6 transition hover:-translate-y-0.5 hover:border-blue-300/22 hover:bg-blue-400/[0.04]"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-300/20 bg-blue-400/[0.08] text-blue-200">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 className="mt-5 text-lg font-bold text-white">{itemTitle}</h2>
                <p className="mt-3 text-sm leading-6 text-white/46">{body}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-200 transition group-hover:text-white">
                  Open resource <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="border-y border-white/[0.07] bg-white/[0.018] px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="video-learning-heading">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-4xl text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-200/60">Video Learning Center</p>
              <h2 id="video-learning-heading" className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
                Learn the concepts behind the <span className="text-blue-300">AI Business Operating System.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-white/50">
                Curated explainers for the foundations D3VONN.IO builds on. Original D3VONN product demos and tutorials can land here as they ship.
              </p>
            </div>

            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {videoLearning.map((item) => (
                <a
                  key={item.title}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-[24px] border border-white/[0.08] bg-white/[0.025] p-6 transition hover:-translate-y-0.5 hover:border-blue-300/22 hover:bg-blue-400/[0.04]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full border border-blue-300/20 bg-blue-400/[0.07] px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-blue-200">
                      {item.category}
                    </span>
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-white/38">
                      {item.kind}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-white">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/46">{item.body}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-200 transition group-hover:text-white">
                    {item.source} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.025] p-3">
              <img
                src="/illustrations/workflow-pipeline.svg"
                alt="D3VONN.IO pilot workflow: goal, Hermes plan, governed execution, measured outcome"
                className="h-auto w-full rounded-[20px]"
                loading="lazy"
              />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-200/60">Pilot operating model</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">One workflow. One measurable outcome. One repeatable demo.</h2>
              <p className="mt-5 text-base leading-7 text-white/50">
                Use the resource hub to move from platform understanding to an operational pilot with visible inputs, governed execution, and a result the buyer can evaluate.
              </p>
            </div>
          </div>
        </section>

        <section className="px-4 pb-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl rounded-[32px] border border-blue-300/15 bg-blue-400/[0.035] p-8 text-center sm:p-10">
            <Download className="mx-auto h-10 w-10 text-blue-200" aria-hidden="true" />
            <h2 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">Pilot checklist</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/50 sm:text-base">
              Turn D3VONN.IO into a measurable buyer conversation with one workflow, one outcome, and one repeatable demo.
            </p>
            <a
              href="/pilot-checklist.md"
              className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 text-sm font-semibold text-white transition hover:bg-blue-600"
            >
              Open checklist <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </section>
      </main>
    </ReaddyMarketingShell>
  );
};

export default Resources;
