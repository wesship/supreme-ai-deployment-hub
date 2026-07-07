import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  Clapperboard,
  FileCheck2,
  Megaphone,
  Mic2,
  Search,
  ShieldCheck,
  Wrench,
} from 'lucide-react';

const featuredAgents = [
  { name: 'Hermes Operator', category: 'Orchestration', status: 'Core', icon: BrainCircuit, desc: 'Plans goals, routes tasks, manages checkpoints, and keeps execution visible.' },
  { name: 'Research Scout', category: 'Research', status: 'Ready', icon: Search, desc: 'Maps markets, competitors, documents, and opportunity signals.' },
  { name: 'Builder Agent', category: 'Product', status: 'Ready', icon: Wrench, desc: 'Turns product requirements into implementation plans and delivery tasks.' },
  { name: 'Security Sentinel', category: 'Security', status: 'Watching', icon: ShieldCheck, desc: 'Surfaces risk, controls, incident posture, and audit-readiness signals.' },
  { name: 'Marketing Engine', category: 'Growth', status: 'Ready', icon: Megaphone, desc: 'Creates campaigns, positioning, offers, and content execution paths.' },
  { name: 'Compliance Reviewer', category: 'Governance', status: 'Review', icon: FileCheck2, desc: 'Checks policy language, approvals, and evidence-ready documentation.' },
  { name: 'Video Studio Agent', category: 'Media', status: 'Studio', icon: Clapperboard, desc: 'Coordinates AI movie, demo, voice, script, and visual production workflows.' },
  { name: 'Voice Interface Agent', category: 'Voice', status: 'Ready', icon: Mic2, desc: 'Supports voice-first operator workflows and conversational task intake.' },
];

const MarketplacePreview: React.FC = () => (
  <section id="marketplace-preview" className="relative overflow-hidden bg-[#031f4f] py-24 scroll-mt-24">
    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_22%_20%,rgba(59,130,246,0.42),transparent_30%),radial-gradient(circle_at_80%_72%,rgba(14,165,233,0.34),transparent_34%)]" />
    <div className="container relative mx-auto px-6">
      <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">Agent Marketplace Preview</p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
            A deployable workforce, not a static software catalog
          </h2>
          <p className="mt-5 text-blue-100/72">
            D3VONN.IO can present every agent as a role in the operating system: what it does, where it fits, and how it moves work forward under Hermes governance.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/marketplace"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200/35 bg-blue-600/85 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_30px_rgba(59,130,246,0.38)] transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              Explore Marketplace
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/agents"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200/20 bg-white/5 px-6 py-3 text-sm font-semibold text-blue-50 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <Bot className="h-4 w-4" />
              View Workforce
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {featuredAgents.map((agent) => {
            const Icon = agent.icon;
            return (
              <Link
                key={agent.name}
                to="/marketplace"
                className="group relative rounded-2xl border border-blue-200/15 bg-blue-400/[0.04] p-5 shadow-[0_0_44px_-16px_rgba(56,136,255,0.38)] backdrop-blur-xl transition hover:-translate-y-1 hover:border-blue-200/45 hover:bg-blue-500/10 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-300/30 bg-blue-500/15 text-blue-100">
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="rounded-full border border-blue-200/20 bg-blue-300/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-blue-100/66">
                    {agent.status}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-bold text-white">{agent.name}</h3>
                <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-blue-100/55">{agent.category}</p>
                <p className="mt-3 text-sm text-blue-100/66">{agent.desc}</p>
                <div className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-200 opacity-80 transition group-hover:translate-x-1 group-hover:opacity-100">
                  Deploy path <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  </section>
);

export default MarketplacePreview;
