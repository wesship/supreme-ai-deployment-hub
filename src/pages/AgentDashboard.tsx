
import React from "react";
import AgentManager from "@/components/agent/AgentManager";
import Container from "@/components/Container";
import SectionHeading from "@/components/SectionHeading";
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';

const AgentDashboard: React.FC = () => {
  return (
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
  );
};

export default AgentDashboard;
