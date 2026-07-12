import React from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import Container from '@/components/Container';
import SectionHeading from '@/components/SectionHeading';
import DocumentationTabs from '@/components/documentation/DocumentationTabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Code, Server, Sparkles } from 'lucide-react';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';
import PublicPageShell from '@/components/shell/PublicPageShell';

const breadcrumbs = [{ label: 'Developer Platform' }, { label: 'Documentation' }];

const Documentation: React.FC = () => {
  const docTypes = [
    {
      title: 'Guides',
      description: 'Step-by-step tutorials for common AI deployment scenarios',
      icon: <BookOpen className="h-5 w-5" aria-hidden="true" />,
      color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    },
    {
      title: 'API Reference',
      description: 'Complete reference for the D3VONN.IO framework API',
      icon: <Code className="h-5 w-5" aria-hidden="true" />,
      color: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    },
    {
      title: 'Deployment',
      description: 'Infrastructure setup and deployment configuration',
      icon: <Server className="h-5 w-5" aria-hidden="true" />,
      color: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    },
    {
      title: 'Examples',
      description: 'Real-world examples of AI systems built with D3VONN.IO',
      icon: <Sparkles className="h-5 w-5" aria-hidden="true" />,
      color: 'bg-green-500/10 text-green-500 border-green-500/20',
    },
  ];

  return (
    <PublicPageShell breadcrumbs={breadcrumbs}>
      <Helmet>
        <title>Developer Documentation — D3VONN.IO</title>
        <meta
          name="description"
          content="Developer guides, API reference, deployment documentation, and implementation examples for the D3VONN.IO platform."
        />
        <link rel="canonical" href="https://d3vonn.io/documentation" />
      </Helmet>

      <section className="d3-os-shell min-h-screen py-10 sm:py-16" aria-labelledby="developer-docs-heading">
        <D3vonnPageBanner title="D3VONN.IO Documentation" />
        <Container maxWidth="2xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <SectionHeading tag="Developer Platform" subheading="Comprehensive guides and reference materials for building on D3VONN.IO">
              <div id="developer-docs-heading" className="flex items-center gap-2">
                D3VONN.IO Documentation
                <motion.div whileHover={{ scale: 1.05 }} transition={{ duration: 0.2 }}>
                  <Badge className="ml-2 border border-primary/30 bg-primary/20 text-primary hover:bg-primary/30">v2.1.0</Badge>
                </motion.div>
              </div>
            </SectionHeading>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            id="features"
            className="mt-8 grid scroll-mt-24 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
            aria-label="Documentation categories"
          >
            {docTypes.map((type) => (
              <motion.div key={type.title} whileHover={{ y: -5, transition: { duration: 0.2 } }}>
                <Card className="h-full border border-primary/10 bg-card/40 backdrop-blur-sm transition-colors hover:border-primary/20">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3">
                      <div className={`rounded-full border p-2 ${type.color}`}>{type.icon}</div>
                      <div>
                        <h2 className="mb-1 font-medium">{type.title}</h2>
                        <p className="text-sm text-muted-foreground">{type.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-10 rounded-lg border border-primary/10 bg-card/40 backdrop-blur-sm"
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
