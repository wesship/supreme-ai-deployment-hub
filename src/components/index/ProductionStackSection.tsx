import React from 'react';
import { motion } from 'framer-motion';
import { Globe, Database, Cpu, Shield, Zap, GitBranch, Cloud, Lock } from 'lucide-react';

const stackLayers = [
  {
    layer: 'Frontend',
    tech: 'React + Vite + TypeScript',
    hosting: 'Vercel',
    color: '#00BFFF',
    icon: Globe,
    items: ['TailwindCSS', 'shadcn/ui', 'Framer Motion', 'React Router'],
  },
  {
    layer: 'Backend API',
    tech: 'FastAPI + Python 3.11',
    hosting: 'Railway',
    color: '#00FF41',
    icon: Cpu,
    items: ['Hermes Task Engine', 'RAG Pipeline', 'OCC Router', 'JWT Auth'],
  },
  {
    layer: 'Database',
    tech: 'Supabase (PostgreSQL)',
    hosting: 'Supabase Cloud',
    color: '#9B59B6',
    icon: Database,
    items: ['19 production tables', 'Row-Level Security', 'Edge Functions', 'Realtime'],
  },
  {
    layer: 'AI Layer',
    tech: 'OpenAI + Pinecone',
    hosting: 'Multi-cloud',
    color: '#FF6B35',
    icon: Zap,
    items: ['GPT-4o', 'text-embedding-3-small', 'RAG ingestion', 'Vector search'],
  },
  {
    layer: 'Security',
    tech: 'Hermes v3 Governance',
    hosting: 'GitHub Actions',
    color: '#E74C3C',
    icon: Shield,
    items: ['OPA policies', 'Agent firewall', 'PR risk heatmaps', 'Secret scanning'],
  },
  {
    layer: 'CI/CD',
    tech: 'GitHub Actions',
    hosting: 'GitHub',
    color: '#F59E0B',
    icon: GitBranch,
    items: ['Auto-deploy to Railway', 'Vercel preview builds', 'Dependabot', 'Security workflows'],
  },
];

const ProductionStackSection: React.FC = () => {
  return (
    <section className="py-20 bg-background">
      <div className="container max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 mb-4">
            <Cloud className="w-3.5 h-3.5 text-primary" />
            <span className="text-primary text-sm font-mono">PRODUCTION STACK</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Enterprise-Grade Infrastructure
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Every layer is production-hardened, observable, and secured. No shortcuts.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {stackLayers.map((layer, i) => {
            const Icon = layer.icon;
            return (
              <motion.div
                key={layer.layer}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="group relative rounded-2xl border border-border bg-card p-6 hover:border-primary/40 transition-all duration-300"
              >
                {/* Colored top accent */}
                <div className="absolute top-0 left-6 right-6 h-0.5 rounded-full opacity-60"
                  style={{ backgroundColor: layer.color }} />

                <div className="flex items-start gap-4 mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${layer.color}15`, border: `1px solid ${layer.color}30` }}>
                    <Icon className="w-5 h-5" style={{ color: layer.color }} />
                  </div>
                  <div>
                    <div className="text-xs font-mono text-muted-foreground mb-0.5">{layer.layer}</div>
                    <div className="font-semibold text-foreground">{layer.tech}</div>
                    <div className="text-xs mt-0.5 flex items-center gap-1">
                      <Lock className="w-3 h-3" style={{ color: layer.color }} />
                      <span style={{ color: layer.color }}>{layer.hosting}</span>
                    </div>
                  </div>
                </div>

                <ul className="space-y-1.5">
                  {layer.items.map(item => (
                    <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: layer.color }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        {/* Overall completion bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 bg-card border border-border rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="font-semibold">Platform Completion</span>
            <span className="text-sm text-muted-foreground font-mono">87% production-ready</span>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Infrastructure', pct: 90 },
              { label: 'Security & Governance', pct: 95 },
              { label: 'Frontend', pct: 90 },
              { label: 'Backend API', pct: 85 },
              { label: 'Agent Runtime', pct: 75 },
              { label: 'Autonomous Orchestration', pct: 65 },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground w-44 flex-shrink-0">{item.label}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${item.pct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full rounded-full bg-primary"
                  />
                </div>
                <span className="text-xs font-mono text-muted-foreground w-10 text-right">{item.pct}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default ProductionStackSection;
