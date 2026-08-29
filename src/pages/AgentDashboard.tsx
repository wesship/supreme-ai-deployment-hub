import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, Bot, BrainCircuit, Network, ShieldCheck, Workflow } from 'lucide-react';
import AgentManager from '@/components/agent/AgentManager';
import AuthenticatedRoute from '@/components/auth/AuthenticatedRoute';
import Container from '@/components/Container';
import PublicPageShell from '@/components/shell/PublicPageShell';
import { D3SectionHeader, D3Surface } from '@/components/d3/D3Surface';

const workforceSignals = [
  { label: 'Orchestration', value: 'Hermes', icon: BrainCircuit },
  { label: 'Knowledge', value: 'DKOS', icon: Network },
  { label: 'Execution', value: 'Governed', icon: Workflow },
  { label: 'Security', value: 'Protected', icon: ShieldCheck },
];

const AgentDashboardContent: React.FC = () => {
  return (
    <PublicPageShell breadcrumbs={[{ label: 'AI Workforce' }]}>
      <Helmet>
        <title>AI Workforce | D3VONN.IO</title>
        <meta
          name="description"
          content="Deploy and govern specialized AI agents through the D3VONN.IO AI Workforce command layer."
        />
        <link rel="canonical" href="https://d3vonn.io/ai-workforce" />
      </Helmet>

      <div className="d3-world min-h-screen">
        <section className="d3-section relative overflow-hidden border-b border-white/[0.06]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(49,151,255,0.16),transparent_28%),radial-gradient(circle_at_14%_42%,rgba(93,114,255,0.11),transparent_32%)]" aria-hidden="true" />
          <Container>
            <div className="relative grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.72fr)]">
              <D3SectionHeader
                eyebrow="D3VONN.IO · AI Workforce"
                title="Your intelligent workforce, under command."
                description="Deploy specialized agents, connect them to memory and knowledge, govern execution, and inspect operational state from one enterprise workspace."
              />

              <D3Surface variant="titanium" glow={2} className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-200/50">Workforce control plane</p>
                    <p className="mt-1 text-sm font-semibold text-white">Hermes orchestration layer</p>
                  </div>
                  <div className="d3-status d3-status--success"><span />Operational</div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {workforceSignals.map(({ label, value, icon: Icon }) => (
                    <div key={label} className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
                      <Icon className="h-4 w-4 text-blue-200" aria-hidden="true" />
                      <p className="mt-5 text-sm font-semibold text-white">{value}</p>
                      <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.17em] text-white/35">{label}</p>
                    </div>
                  ))}
                </div>
              </D3Surface>
            </div>

            <div className="relative mt-8 flex flex-wrap gap-3">
              <a href="#workforce-console" className="d3-btn-primary">
                <Bot className="h-4 w-4" aria-hidden="true" /> Open workforce console
              </a>
              <Link to="/workflows" className="d3-btn-secondary">
                Automation <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link to="/app" className="d3-btn-secondary">
                Business OS <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </Container>
        </section>

        <section id="workforce-console" className="d3-section pt-4 sm:pt-6">
          <Container>
            <AgentManager />
          </Container>
        </section>
      </div>
    </PublicPageShell>
  );
};

const AgentDashboard: React.FC = () => (
  <AuthenticatedRoute>
    <AgentDashboardContent />
  </AuthenticatedRoute>
);

export default AgentDashboard;
