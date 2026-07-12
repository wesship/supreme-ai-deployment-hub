import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { AgentTemplate, MarketplaceFilters as FilterType, AgentDeploymentConfig } from '@/types/marketplace';
import { mockAgentTemplates } from '@/data/mockAgentTemplates';
import { videoProductionAgentTemplates } from '@/data/videoIntelligenceLayer';
import { brandForgeAgentTemplates } from '@/data/brandForgeLayer';
import PublicPageShell from '@/components/shell/PublicPageShell';
import MarketplaceHeader from '@/components/marketplace/MarketplaceHeader';
import MarketplaceFilters from '@/components/marketplace/MarketplaceFilters';
import FeaturedAgents from '@/components/marketplace/FeaturedAgents';
import AgentCard from '@/components/marketplace/AgentCard';
import AgentDetailModal from '@/components/marketplace/AgentDetailModal';
import DeployAgentModal from '@/components/marketplace/DeployAgentModal';
import { toast } from '@/hooks/use-toast';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';

const marketplaceAgents: AgentTemplate[] = [
  ...brandForgeAgentTemplates,
  ...videoProductionAgentTemplates,
  ...mockAgentTemplates,
];

const breadcrumbs = [{ label: 'Marketplace' }, { label: 'Agent Marketplace' }];

const AgentMarketplace: React.FC = () => {
  const [filters, setFilters] = useState<FilterType>({ sortBy: 'popular' });
  const [selectedAgent, setSelectedAgent] = useState<AgentTemplate | null>(null);
  const [deployAgent, setDeployAgent] = useState<AgentTemplate | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);

  const filteredAgents = useMemo(() => {
    let result = [...marketplaceAgents];

    if (filters.category) {
      result = result.filter((agent) => agent.category === filters.category);
    }

    if (filters.pricing) {
      result = result.filter((agent) => agent.pricing.model === filters.pricing);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(
        (agent) =>
          agent.name.toLowerCase().includes(searchLower) ||
          agent.description.toLowerCase().includes(searchLower) ||
          agent.tags.some((tag) => tag.toLowerCase().includes(searchLower)),
      );
    }

    if (filters.minRating) {
      result = result.filter((agent) => agent.stats.avgRating >= filters.minRating!);
    }

    switch (filters.sortBy) {
      case 'popular':
        result.sort((a, b) => b.stats.activeInstalls - a.stats.activeInstalls);
        break;
      case 'newest':
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'rating':
        result.sort((a, b) => b.stats.avgRating - a.stats.avgRating);
        break;
      case 'price-low':
        result.sort((a, b) => (a.pricing.amount || 0) - (b.pricing.amount || 0));
        break;
      case 'price-high':
        result.sort((a, b) => (b.pricing.amount || 0) - (a.pricing.amount || 0));
        break;
    }

    return result;
  }, [filters]);

  const featuredAgents = marketplaceAgents.filter((agent) => agent.featured);

  const handleViewAgent = (agent: AgentTemplate) => {
    setSelectedAgent(agent);
    setShowDetailModal(true);
  };

  const handleDeployAgent = (agent: AgentTemplate) => {
    setDeployAgent(agent);
    setShowDeployModal(true);
    setShowDetailModal(false);
  };

  const handleDeployComplete = (agent: AgentTemplate, config: AgentDeploymentConfig) => {
    console.log('Deployed:', agent.name, config);
    setShowDeployModal(false);
  };

  const handlePublishClick = () => {
    toast({
      title: 'Coming Soon',
      description: 'Agent publishing will be available in the next release.',
    });
  };

  return (
    <PublicPageShell breadcrumbs={breadcrumbs}>
      <Helmet>
        <title>Enterprise Agent Marketplace — D3VONN.IO</title>
        <meta
          name="description"
          content="Discover, evaluate, and deploy enterprise-ready AI agents by capability, industry, rating, and deployment model."
        />
        <link rel="canonical" href="https://d3vonn.io/marketplace" />
      </Helmet>

      <section className="d3-os-shell bg-background" aria-labelledby="marketplace-heading">
        <D3vonnPageBanner title="Enterprise Agent Marketplace" />
        <div className="container mx-auto px-4 py-8 sm:px-6 sm:py-12">
          <div className="d3-chrome-panel mb-8 rounded-3xl p-6 sm:p-8">
            <div className="d3-system-status">Verified agent ecosystem</div>
            <h1 id="marketplace-heading" className="mt-4 text-3xl font-black text-white sm:text-5xl">
              Deploy specialized intelligence
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60 sm:text-base">
              Discover enterprise-ready agents by capability, industry, rating, and deployment model. Review each agent before connecting it to your organization.
            </p>
          </div>

          <MarketplaceHeader
            totalAgents={marketplaceAgents.length}
            featuredCount={featuredAgents.length}
            onPublishClick={handlePublishClick}
          />

          <div className="d3-chrome-panel rounded-2xl p-4 sm:p-6" aria-label="Featured agents">
            <FeaturedAgents agents={featuredAgents} onView={handleViewAgent} onDeploy={handleDeployAgent} />
          </div>

          <div className="d3-chrome-panel mt-8 rounded-2xl p-4 sm:p-6" aria-label="Marketplace catalog">
            <MarketplaceFilters filters={filters} onFiltersChange={setFilters} />

            <div className="my-6 flex items-center justify-between" aria-live="polite">
              <p className="text-sm text-muted-foreground">
                Showing <strong>{filteredAgents.length}</strong> agents
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredAgents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} onView={handleViewAgent} onDeploy={handleDeployAgent} />
              ))}
            </div>

            {filteredAgents.length === 0 && (
              <div className="py-16 text-center" role="status">
                <div className="mb-4 text-6xl" aria-hidden="true">🔍</div>
                <h2 className="mb-2 text-lg font-semibold">No agents found</h2>
                <p className="text-muted-foreground">Try adjusting your filters or search terms.</p>
              </div>
            )}
          </div>

          <AgentDetailModal
            agent={selectedAgent}
            open={showDetailModal}
            onClose={() => setShowDetailModal(false)}
            onDeploy={handleDeployAgent}
          />

          <DeployAgentModal
            agent={deployAgent}
            open={showDeployModal}
            onClose={() => setShowDeployModal(false)}
            onDeployComplete={handleDeployComplete}
          />
        </div>
      </section>
    </PublicPageShell>
  );
};

export default AgentMarketplace;
