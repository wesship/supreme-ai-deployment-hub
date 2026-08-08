import React from 'react';
import { Helmet } from 'react-helmet-async';
import Container from '@/components/Container';
import APIConnectionsTab from '@/components/api/APIConnectionsTab';
import ProxyVaultPanel from '@/components/deployment/credentials/ProxyVaultPanel';
import PublicPageShell from '@/components/shell/PublicPageShell';
import ProductWorkspaceHero from '@/components/d3/ProductWorkspaceHero';
import { Braces, KeyRound, Network, ShieldCheck } from 'lucide-react';

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
        <Container>
          <div className="py-10 sm:py-14 lg:py-16">
            <ProductWorkspaceHero
              eyebrow="Developer Platform"
              status="Developer gateway operational"
              title={<span id="api-management-heading">Build on the D3VONN.IO intelligence layer</span>}
              description="Connect external services, manage integration boundaries, and give agents governed access to the APIs they need without exposing private credentials in the browser."
            >
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['API gateway', 'Connected', Braces],
                  ['Credentials', 'Vaulted', KeyRound],
                  ['Integrations', 'Extensible', Network],
                  ['Boundary', 'Server-side', ShieldCheck],
                ].map(([label, value, Icon]) => (
                  <div key={String(label)} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    {typeof Icon !== 'string' && <Icon className="h-4 w-4 text-blue-200" aria-hidden="true" />}
                    <div className="mt-3 text-sm font-semibold text-white">{String(value)}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/45">{String(label)}</div>
                  </div>
                ))}
              </div>
            </ProductWorkspaceHero>

            <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3" aria-label="API management workspace">
              <div className="d3-surface lg:col-span-2 p-4 sm:p-6">
                <APIConnectionsTab />
              </div>
              <aside className="d3-surface lg:col-span-1 p-4 sm:p-6" aria-label="Secure proxy vault">
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
