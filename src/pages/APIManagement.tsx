import React from 'react';
import { Helmet } from 'react-helmet-async';
import Container from '@/components/Container';
import SectionHeading from '@/components/SectionHeading';
import APIConnectionsTab from '@/components/api/APIConnectionsTab';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';
import ProxyVaultPanel from '@/components/deployment/credentials/ProxyVaultPanel';
import PublicPageShell from '@/components/shell/PublicPageShell';

const breadcrumbs = [{ label: 'Developer Platform' }, { label: 'API Management' }];

const APIManagement: React.FC = () => {
  const title = 'API Management — D3VONN.IO Developer Platform';
  const description = 'Connect, secure, and manage external APIs for D3VONN.IO agents, workflows, and enterprise integrations.';

  return (
    <PublicPageShell breadcrumbs={breadcrumbs}>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href="https://d3vonn.io/api" />
      </Helmet>

      <section className="d3-os-shell min-h-screen" aria-labelledby="api-management-heading">
        <D3vonnPageBanner title="API Management" />
        <Container>
          <div className="py-10 sm:py-14">
            <SectionHeading subheading="Connect D3VONN.IO to external services and APIs while keeping credentials behind controlled server-side boundaries.">
              <span id="api-management-heading">API Management</span>
            </SectionHeading>

            <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3" aria-label="API management workspace">
              <div className="lg:col-span-2">
                <APIConnectionsTab />
              </div>
              <aside className="lg:col-span-1" aria-label="Secure proxy vault">
                <ProxyVaultPanel />
              </aside>
            </div>
          </div>
        </Container>
      </section>
    </PublicPageShell>
  );
};

export default APIManagement;
