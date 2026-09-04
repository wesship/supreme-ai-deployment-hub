import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Boxes, Bot, Database, Layers3, ShieldCheck } from 'lucide-react';
import { AgentTemplate, MarketplaceFilters as FilterType, AgentDeploymentConfig } from '@/types/marketplace';
import PublicPageShell from '@/components/shell/PublicPageShell';
import MarketplaceHeader from '@/components/marketplace/MarketplaceHeader';
import MarketplaceFilters from '@/components/marketplace/MarketplaceFilters';
import FeaturedAgents from '@/components/marketplace/FeaturedAgents';
import AgentCard from '@/components/marketplace/AgentCard';
import AgentDetailModal from '@/components/marketplace/AgentDetailModal';
import DeployAgentModal from '@/components/marketplace/DeployAgentModal';
import ProductWorkspaceHero from '@/components/d3/ProductWorkspaceHero';
import { toast } from '@/hooks/use-toast';
import { useMarketplaceAgents } from '@/hooks/useMarketplaceAgents';

const breadcrumbs = [{ label: 'Marketplace' }, { label: 'Agent Marketplace' }];

const AgentMarketplace: React.FC = () => {
  const [filters, setFilters] = useState<FilterType>({ sortBy: 'popular' });
  const [selectedAgent, setSelectedAgent] = useState<AgentTemplate | null>(null);
  const [deployAgent, setDeployAgent] = useState<AgentTemplate | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const { agents: marketplaceAgents, loading, error, source, live } = useMarketplaceAgents();

  const filteredAgents = useMemo(() => {
    const result = [...marketplaceAgents];
    let filtered = result;
    if (filters.category) filtered = filtered.filter((agent) => agent.category === filters.category);
    if (filters.pricing) filtered = filtered.filter((agent) => agent.pricing.model === filters.pricing);
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter((agent) =>
        agent.name.toLowerCase().includes(searchLower) ||
        agent.description.toLowerCase().includes(searchLower) ||
        agent.tags.some((tag) => tag.toLowerCase().includes(searchLower)),
      );
    }
    if (filters.minRating) filtered = filtered.filter((agent) => agent.stats.avgRating >= filters.minRating!);

    switch (filters.sortBy) {
      case 'popular':
        filtered.sort((a, b) => b.stats.activeInstalls - a.stats.activeInstalls || a.name.localeCompare(b.name));
        break;
      case 'newest':
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'rating':
        filtered.sort((a, b) => b.stats.avgRating - a.stats.avgRating || a.name.localeCompare(b.name));
        break;
      case 'price-low':
        filtered.sort((a, b) => {
          const aPrice = a.pricing.amount;
          const bPrice = b.pricing.amount;
          if (aPrice == null && bPrice == null) return a.name.localeCompare(b.name);
          if (aPrice == null) return 1;
          if (bPrice == null) return -1;
          return aPrice - bPrice;
        });
        break;
      case 'price-high':
        filtered.sort((a, b) => {
          const aPrice = a.pricing.amount;
          const bPrice = b.pricing.amount;
          if (aPrice == null && bPrice == null) return a.name.localeCompare(b.name);
          if (aPrice == null) return 1;
          if (bPrice == null) return -1;
          return bPrice - aPrice;
        });
        break;
    }
    return filtered;
  }, [filters, marketplaceAgents]);

  const featuredAgents = useMemo(() => marketplaceAgents.filter((agent) => agent.featured), [marketplaceAgents]);
  const handleViewAgent = (agent: AgentTemplate) => { setSelectedAgent(agent); setShowDetailModal(true); };
  const handleDeployAgent = (agent: AgentTemplate) => { setDeployAgent(agent); setShowDeployModal(true); setShowDetailModal(false); };
  const handleDeployComplete = (agent: AgentTemplate, config: AgentDeploymentConfig) => { console.log('Deployed:', agent.name, config); setShowDeployModal(false); };
  const handlePublishClick = () => toast({ title: 'Coming Soon', description: 'Agent publishing will be available in the next release.' });
  const registryStatus = error ? 'Registry unavailable' : loading ? 'Loading live registry' : live ? 'Live agent registry' : 'Registry snapshot';

  return (
    <PublicPageShell breadcrumbs={breadcrumbs}>
      <Helmet>
        <title>Enterprise Agent Marketplace — D3VONN.IO</title>
        <meta name="description" content="Discover, evaluate, and deploy enterprise-ready AI agents from the live D3VONN.IO registry." />
        <link rel="canonical" href="https://d3vonn.io/marketplace" />
      </Helmet>

      <section className="d3-homepage-world min-h-screen px-4 py-8 sm:px-6 sm:py-12 lg:px-8" aria-labelledby="marketplace-heading">
        <div className="mx-auto max-w-7xl space-y-8">
          <ProductWorkspaceHero
            status={registryStatus}
            eyebrow="D3VONN.IO Marketplace"
            title={<span id="marketplace-heading">Deploy specialized intelligence.</span>}
            description="Discover enterprise-ready agents sourced from D3VONN.IO's canonical runtime registry. Registry state is live; unsupported marketplace telemetry is never fabricated."
          >
            <div className="grid grid-cols-2 gap-3">
              {[
                [`${marketplaceAgents.length} live agents`, Bot],
                [`${featuredAgents.length} featured`, Layers3],
                ['Governed deploy', ShieldCheck],
                [source === 'agent_registry' ? 'Canonical registry' : 'Backend catalog', Database],
              ].map(([label, Icon]) => (
                <div key={String(label)} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  {typeof Icon !== 'string' && <Icon className="h-4 w-4 text-blue-200" aria-hidden="true" />}
                  <div className="mt-3 text-xs font-semibold text-white">{String(label)}</div>
                </div>
              ))}
            </div>
          </ProductWorkspaceHero>

          <div className="d3-surface p-4 sm:p-6">
            <MarketplaceHeader totalAgents={marketplaceAgents.length} featuredCount={featuredAgents.length} onPublishClick={handlePublishClick} />
          </div>

          {loading && (
            <div className="d3-surface p-6 text-sm text-muted-foreground" role="status">
              Loading the canonical D3VONN.IO agent registry…
            </div>
          )}

          {error && (
            <div className="d3-surface border border-amber-400/20 p-6" role="alert">
              <div className="flex items-start gap-3">
                <Boxes className="mt-0.5 h-5 w-5 text-amber-200" aria-hidden="true" />
                <div>
                  <h2 className="font-semibold text-white">Live marketplace data is unavailable</h2>
                  <p className="mt-1 text-sm text-muted-foreground">The catalog is not falling back to mock agents. Try again after the registry service is restored.</p>
                </div>
              </div>
            </div>
          )}

          {featuredAgents.length > 0 && (
            <div className="d3-titanium-panel p-4 sm:p-6" aria-label="Featured agents">
              <FeaturedAgents agents={featuredAgents} onView={handleViewAgent} onDeploy={handleDeployAgent} />
            </div>
          )}

          <div className="d3-surface p-4 sm:p-6" aria-label="Marketplace catalog">
            <MarketplaceFilters filters={filters} onFiltersChange={setFilters} />
            <div className="my-6 flex items-center justify-between" aria-live="polite">
              <p className="text-sm text-muted-foreground">Showing <strong>{filteredAgents.length}</strong> agents</p>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredAgents.map((agent) => <AgentCard key={agent.id} agent={agent} onView={handleViewAgent} onDeploy={handleDeployAgent} />)}
            </div>
            {!loading && !error && filteredAgents.length === 0 && (
              <div className="py-16 text-center" role="status">
                <div className="mb-4 text-6xl" aria-hidden="true">⌕</div>
                <h2 className="mb-2 text-lg font-semibold">No agents found</h2>
                <p className="text-muted-foreground">Try adjusting your filters or search terms.</p>
              </div>
            )}
          </div>

          <AgentDetailModal agent={selectedAgent} open={showDetailModal} onClose={() => setShowDetailModal(false)} onDeploy={handleDeployAgent} />
          <DeployAgentModal agent={deployAgent} open={showDeployModal} onClose={() => setShowDeployModal(false)} onDeployComplete={handleDeployComplete} />
        </div>
      </section>
    </PublicPageShell>
  );
};

export default AgentMarketplace;
