import React from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import Container from '@/components/Container';
import DocumentationTabs from '@/components/documentation/DocumentationTabs';
import { BookOpen, Code, Server, Sparkles } from 'lucide-react';
import PublicPageShell from '@/components/shell/PublicPageShell';
import ProductWorkspaceHero from '@/components/d3/ProductWorkspaceHero';

const breadcrumbs = [{ label: 'Developer Platform' }, { label: 'Documentation' }];

const Documentation: React.FC = () => {
  const docTypes = [
    { title: 'Guides', description: 'Step-by-step implementation paths', icon: BookOpen },
    { title: 'API Reference', description: 'Platform interfaces and contracts', icon: Code },
    { title: 'Deployment', description: 'Infrastructure and delivery guidance', icon: Server },
    { title: 'Examples', description: 'Production-oriented implementation patterns', icon: Sparkles },
  ];

  return (
    <PublicPageShell breadcrumbs={breadcrumbs}>
      <Helmet>
        <title>Developer Documentation — D3VONN.IO</title>
        <meta name="description" content="Developer guides, API reference, deployment documentation, and implementation examples for the D3VONN.IO platform." />
        <link rel="canonical" href="https://d3vonn.io/documentation" />
      </Helmet>

      <section className="d3-os-shell min-h-screen" aria-labelledby="developer-docs-heading">
        <Container maxWidth="2xl" className="py-10 sm:py-14 lg:py-16">
          <ProductWorkspaceHero
            eyebrow="Developer Platform"
            status="Documentation online"
            title={<span id="developer-docs-heading">Understand the system. Build with confidence.</span>}
            description="Explore the architecture, APIs, deployment model, and implementation patterns behind D3VONN.IO without sacrificing readability for visual spectacle."
          >
            <div className="grid grid-cols-2 gap-3">
              {docTypes.map(({ title, description, icon: Icon }) => (
                <div key={title} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <Icon className="h-4 w-4 text-blue-200" aria-hidden="true" />
                  <div className="mt-3 text-sm font-semibold text-white">{title}</div>
                  <div className="mt-1 text-xs leading-5 text-white/45">{description}</div>
                </div>
              ))}
            </div>
          </ProductWorkspaceHero>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="d3-surface mt-8 overflow-hidden"
            aria-label="Developer documentation workspace"
          >
            <DocumentationTabs />
          </motion.div>
        </Container>
      </section>
    </PublicPageShell>
  );
};

export default Documentation;
