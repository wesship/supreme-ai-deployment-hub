
import React from 'react';
import AgentChatInterface from '@/components/agui/AgentChatInterface';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';

const AgentDemo = () => {
  return (
    <div className="container mx-auto py-6">
      <D3vonnPageBanner title="Agent Demo" />
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">AG-UI Demo</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          This demo shows the integration between Devon.AI and AG-UI for agent interactions.
          Try sending a message to see the agent's response with token-by-token streaming.
        </p>
        
        <div className="h-[600px]">
          <AgentChatInterface 
            title="Devon.AI Agent" 
            placeholder="Ask the agent something..." 
          />
        </div>
      </div>
    </div>
  );
};

export default AgentDemo;
