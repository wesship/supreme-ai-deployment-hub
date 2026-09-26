import React from 'react';
import { Link } from 'react-router-dom';
import {
  Bot,
  BrainCircuit,
  Clapperboard,
  Database,
  LineChart,
  Network,
  RadioTower,
  ShieldCheck,
  ShoppingCart,
  Workflow,
} from 'lucide-react';

const graphNodes = [
  { id: 'intent', label: 'User Intent', x: 50, y: 10, to: '/app', icon: RadioTower },
  { id: 'hermes', label: 'Hermes Orchestrator', x: 50, y: 30, to: '/workflows', icon: BrainCircuit },
  { id: 'agents', label: 'AI Workforce', x: 22, y: 46, to: '/agents', icon: Bot },
  { id: 'kg', label: 'Knowledge Graph', x: 50, y: 52, to: '/knowledge-graph', icon: Network },
  { id: 'rag', label: 'Memory + RAG', x: 76, y: 46, to: '/rag', icon: Database },
  { id: 'workflow', label: 'Workflow Engine', x: 32, y: 72, to: '/workflows', icon: Workflow },
  { id: 'market', label: 'Marketplace', x: 62, y: 72, to: '/marketplace', icon: ShoppingCart },
  { id: 'soc', label: 'SOC / Security', x: 18, y: 88, to: '/security/command-center', icon: ShieldCheck },
  { id: 'film', label: 'AI Movie Studio', x: 50, y: 92, to: '/film', icon: Clapperboard },
  { id: 'analytics', label: 'Analytics', x: 82, y: 88, to: '/analytics', icon: LineChart },
];

const edges = [
  ['intent', 'hermes'],
  ['hermes', 'agents'],
  ['hermes', 'kg'],
  ['hermes', 'rag'],
  ['agents', 'workflow'],
  ['kg', 'workflow'],
  ['rag', 'market'],
  ['workflow', 'soc'],
  ['workflow', 'film'],
  ['market', 'analytics'],
  ['kg', 'analytics'],
];

const getNode = (id: string) => graphNodes.find((node) => node.id === id)!;

const KnowledgeGraphPreview: React.FC = () => (
  <section id="knowledge-graph" className="relative overflow-hidden bg-[#080806] py-24 scroll-mt-24">
    <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_50%_20%,rgba(96,165,250,0.55),transparent_34%),radial-gradient(circle_at_20%_80%,rgba(14,165,233,0.28),transparent_32%),radial-gradient(circle_at_80%_80%,rgba(59,130,246,0.28),transparent_32%)]" />
    <div className="container relative mx-auto px-6">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200/80">Operational Knowledge Graph</p>
        <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
          Operate the system as a connected intelligence network
        </h2>
        <p className="mt-4 text-stone-300/70">
          Trace how intent moves through Hermes, agents, knowledge, tools, workflows, security, media, and operations — then open the full graph to inspect and act on those relationships.
        </p>
      </div>

      <div className="mt-14 hidden border border-[#2d2c28] bg-[#0d0d0b] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.34)] lg:block">
        <div className="relative mx-auto h-[620px] max-w-6xl overflow-hidden border border-[#2d2c28] bg-[#090907]">
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="kgLine" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#93c5fd" stopOpacity="0.2" />
                <stop offset="0.5" stopColor="#38bdf8" stopOpacity="0.72" />
                <stop offset="1" stopColor="#2563eb" stopOpacity="0.22" />
              </linearGradient>
            </defs>
            {edges.map(([from, to]) => {
              const a = getNode(from);
              const b = getNode(to);
              return (
                <line
                  key={`${from}-${to}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="url(#kgLine)"
                  strokeWidth="0.28"
                  strokeLinecap="round"
                />
              );
            })}
          </svg>

          {graphNodes.map((node) => {
            const Icon = node.icon;
            return (
              <Link
                key={node.id}
                to={node.to}
                className="group absolute -translate-x-1/2 -translate-y-1/2 border border-[#34332f] bg-[#141411] px-4 py-3 text-center shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition hover:z-10 hover:-translate-y-1 hover:border-amber-200/45 hover:bg-[#1a1812] focus:outline-none focus:ring-2 focus:ring-amber-100"
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
                aria-label={`Open ${node.label}`}
              >
                <span className="mx-auto flex h-12 w-12 items-center justify-center border border-[#3a382f] bg-[#0c0c0a] transition group-hover:border-amber-200/35 group-hover:bg-[#17150f]">
                  <Icon className="h-5 w-5 text-amber-100" />
                </span>
                <span className="mt-3 block whitespace-nowrap text-xs font-bold uppercase tracking-[0.14em] text-stone-100">
                  {node.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:hidden">
        {graphNodes.map((node) => {
          const Icon = node.icon;
          return (
            <Link
              key={node.id}
              to={node.to}
              className="flex items-center gap-3 border border-[#2d2c28] bg-[#11110f] p-4 transition hover:border-amber-100/35 hover:bg-amber-100/[0.04] focus:outline-none focus:ring-2 focus:ring-amber-100"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-amber-100/20 bg-amber-100/[0.06]">
                <Icon className="h-5 w-5 text-amber-100" />
              </span>
              <span className="text-sm font-semibold text-stone-100">{node.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  </section>
);

export default KnowledgeGraphPreview;
