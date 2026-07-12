import React from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import Container from '@/components/Container';
import PublicPageShell from '@/components/shell/PublicPageShell';
import WorkflowManager from '@/components/workflow/WorkflowManager';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';

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

      <section className="d3-os-shell" aria-labelledby="automation-heading">
        <D3vonnPageBanner title="Automation Studio" />
        <Container maxWidth="2xl" className="py-8 sm:py-12 lg:py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-6 d3-chrome-panel rounded-2xl p-5 sm:p-6">
              <div className="d3-system-status">Workflow engine ready</div>
              <h1 id="automation-heading" className="mt-4 text-2xl font-bold sm:text-3xl">
                Automation Orchestration
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-white/60">
                Design, execute, and monitor governed workflows with clear progression, live state, and human approval points.
              </p>
            </div>

            <div className="d3-chrome-panel rounded-2xl p-3 sm:p-5" aria-label="Workflow management workspace">
              <WorkflowManager />
            </div>
          </motion.div>
        </Container>
      </section>
    </PublicPageShell>
  );
};

export default WorkflowManagement;
