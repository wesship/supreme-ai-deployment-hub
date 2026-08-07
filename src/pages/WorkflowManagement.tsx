import React from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Activity, GitBranch, ShieldCheck, Workflow } from 'lucide-react';
import Container from '@/components/Container';
import PublicPageShell from '@/components/shell/PublicPageShell';
import WorkflowManager from '@/components/workflow/WorkflowManager';
import D3Surface, { D3SectionHeader } from '@/components/d3/D3Surface';

const breadcrumbs = [{ label: 'Automation Studio' }, { label: 'Workflows' }];

const WorkflowManagement: React.FC = () => {
  return (
    <PublicPageShell breadcrumbs={breadcrumbs}>
      <Helmet>
        <title>Automation Studio & Workflows — D3VONN.IO</title>
        <meta
          name="description"
          content="Design, execute, govern, and monitor D3VONN.IO automation workflows with live state and human approval controls."
        />
        <link rel="canonical" href="https://d3vonn.io/workflows" />
      </Helmet>

      <section className="d3-os-shell d3-workspace-shell" aria-labelledby="automation-heading">
        <Container maxWidth="2xl" className="py-8 sm:py-12 lg:py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <D3Surface tone="titanium" className="relative overflow-hidden p-6 sm:p-8">
              <div className="pointer-events-none absolute left-[58%] top-[-55%] h-80 w-80 rounded-full bg-blue-500/12 blur-3xl" aria-hidden="true" />
              <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
                <D3SectionHeader
                  eyebrow="Automation Studio"
                  title="Automation Orchestration"
                  description="Design, execute, and monitor governed workflows with visible state, branching logic, verification, and human approval points."
                />
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <span className="d3-system-status"><Activity className="h-3.5 w-3.5" /> engine ready</span>
                  <span className="d3-system-status"><ShieldCheck className="h-3.5 w-3.5" /> approval aware</span>
                </div>
              </div>
            </D3Surface>

            <div className="mt-5 grid gap-3 sm:grid-cols-3" aria-label="Automation operating model">
              {[
                ['Trigger', 'Start from events, schedules, users, or agent decisions.', Workflow],
                ['Orchestrate', 'Branch across agents, tools, data, and governed actions.', GitBranch],
                ['Verify', 'Capture execution state, approvals, outcomes, and retries.', ShieldCheck],
              ].map(([title, copy, Icon]) => {
                const LucideIcon = Icon as React.ElementType;
                return (
                  <D3Surface key={String(title)} interactive className="p-4 sm:p-5">
                    <LucideIcon className="h-5 w-5 text-blue-200" aria-hidden="true" />
                    <h2 className="mt-4 text-sm font-semibold text-white">{String(title)}</h2>
                    <p className="mt-1 text-xs leading-5 text-white/45">{String(copy)}</p>
                  </D3Surface>
                );
              })}
            </div>

            <D3Surface tone="strong" className="mt-5 p-3 sm:p-5" aria-label="Workflow management workspace">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
                <div>
                  <div className="d3-kicker">Execution workspace</div>
                  <h2 className="mt-2 text-lg font-semibold text-white">Workflow Engine</h2>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-100/45">
                  Trigger → Decide → Execute → Verify → Remember
                </span>
              </div>
              <WorkflowManager />
            </D3Surface>
          </motion.div>
        </Container>
      </section>
    </PublicPageShell>
  );
};

export default WorkflowManagement;
