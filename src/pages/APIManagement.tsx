
import React from 'react';
import { Helmet } from 'react-helmet';
import Container from '@/components/Container';
import SectionHeading from '@/components/SectionHeading';
import APIConnectionsTab from '@/components/api/APIConnectionsTab';

const APIManagement: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>API Management - D3VONN.IO</title>
      </Helmet>
      <Container>
        <SectionHeading
          subheading="Connect D3VONN.IO to external services and APIs to extend its capabilities."
        >
          API Management
        </SectionHeading>
        
        <div className="mt-8">
          <APIConnectionsTab />
        </div>
      </Container>
    </>
  );
};

export default APIManagement;
