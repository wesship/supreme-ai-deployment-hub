
import React from 'react';
import { Helmet } from 'react-helmet';
import Container from '@/components/Container';
import SectionHeading from '@/components/SectionHeading';
import APIConnectionsTab from '@/components/api/APIConnectionsTab';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';
import ProxyVaultPanel from '@/components/deployment/credentials/ProxyVaultPanel';

const APIManagement: React.FC = () => {
  return (
    <>
      <D3vonnPageBanner title="API Management" />
      <Helmet>
        <title>API Management - D3VONN.IO</title>
      </Helmet>
      <Container>
        <SectionHeading
          subheading="Connect D3VONN.IO to external services and APIs to extend its capabilities."
        >
          API Management
        </SectionHeading>
        
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main API connections panel — takes 2/3 width on large screens */}
          <div className="lg:col-span-2">
            <APIConnectionsTab />
          </div>
          {/* Proxy vault sidebar */}
          <div className="lg:col-span-1">
            <ProxyVaultPanel />
          </div>
        </div>
      </Container>
    </>
  );
};

export default APIManagement;
