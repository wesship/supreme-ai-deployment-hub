
import React from 'react';
import PocketFlow from '@/components/flow/PocketFlow';
import { ReactFlowProvider } from '@xyflow/react';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';

const FlowEditor: React.FC = () => {
  return (
    <div className="w-full h-screen">
      <D3vonnPageBanner title="Flow Editor" />
      <ReactFlowProvider>
        <PocketFlow />
      </ReactFlowProvider>
    </div>
  );
};

export default FlowEditor;
