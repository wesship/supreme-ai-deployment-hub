import React from 'react';
import { Helmet } from 'react-helmet-async';
import AgentManager from '@/components/agent/AgentManager';
import Container from '@/components/Container';
import SectionHeading from '@/components/SectionHeading';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';
import PublicPageShell from '@/components/shell/PublicPageShell';

const AgentDashboard: React.FC = () => {
  return (
    <PublicPageShell breadcrumbs={[{ label: 'AI Workforce' }]}>
      <Helmet>
        <title>AI Workforce | D3VONN.IO</title>
        <meta
          name="description"
          content="Deploy and govern specialized AI agents through the D3VONN.IO AI Workforce command layer."
        />
        <link rel="canonical" href="https://d3vonn.io/agents" />
      </Helmet>

      <div className="d3-os-shell min-h-screen">
        <D3vonnPageBanner title="AI Workforce" />
        <SectionHeading
          tag="Executive AI Workforce"
          subheading="Deploy specialized agents with visible memory, governance, tools, integrations, and operational state."
        >
          AI Workforce Command
        </SectionHeading>
        <Container>
          <AgentManager />
        </Container>
      </div>
    </PublicPageShell>
  );
};

export default AgentDashboard;
