import React from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Cloud, Database, Network, Server } from 'lucide-react';
import DeploymentPage from '@/components/deployment/DeploymentPage';
import Footer from '@/components/Footer';
import Container from '@/components/Container';
import PublicPageShell from '@/components/shell/PublicPageShell';
import ProductWorkspaceHero from '@/components/d3/ProductWorkspaceHero';
import { DeploymentProvider } from '@/contexts/DeploymentContext';

const breadcrumbs = [{ label: 'Infrastructure' }, { label: 'Deployment' }];

const DeploymentDashboard: React.FC = () => {
  return (
    <DeploymentProvider>
      <PublicPageShell breadcrumbs={breadcrumbs}>
        <Helmet>
          <title>Infrastructure & Deployment — D3VONN.IO</title>
          <meta name="description" content="Operate D3VONN.IO deployment, service health, infrastructure, and production delivery from one governed command surface." />
          <link rel="canonical" href="https://d3vonn.io/deployment" />
        </Helmet>

        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="d3-os-shell min-h-screen"
          aria-labelledby="deployment-heading"
        >
          <Container maxWidth="2xl" className="py-10 sm:py-14 lg:py-16">
            <ProductWorkspaceHero
              eyebrow="Infrastructure"
              status="Deployment control plane ready"
              title={<span id="deployment-heading">Global infrastructure under command</span>}
              description="Monitor deployment state, service connectivity, delivery health, and production infrastructure from the same operating-system layer that governs your AI workforce."
            >
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Compute', 'Managed', Server],
                  ['Cloud', 'Connected', Cloud],
                  ['Data', 'Persistent', Database],
                  ['Network', 'Observable', Network],
                ].map(([label, value, Icon]) => (
                  <div key={String(label)} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    {typeof Icon !== 'string' && <Icon className="h-4 w-4 text-blue-200" aria-hidden="true" />}
                    <div className="mt-3 text-sm font-semibold text-white">{String(value)}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/45">{String(label)}</div>
                  </div>
                ))}
              </div>
            </ProductWorkspaceHero>

            <div className="d3-surface mt-8 overflow-hidden p-1 sm:p-2">
              <DeploymentPage />
            </div>
          </Container>
        </motion.section>
        <Footer />
      </PublicPageShell>
    </DeploymentProvider>
  );
};

export default DeploymentDashboard;
