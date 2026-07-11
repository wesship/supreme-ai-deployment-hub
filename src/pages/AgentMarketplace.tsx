import React, { useState, useMemo } from 'react';
import { AgentTemplate, MarketplaceFilters as FilterType, AgentDeploymentConfig } from '@/types/marketplace';
import { mockAgentTemplates } from '@/data/mockAgentTemplates';
import { videoProductionAgentTemplates } from '@/data/videoIntelligenceLayer';
import { brandForgeAgentTemplates } from '@/data/brandForgeLayer';
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

const AgentMarketplace: React.FC = () => {
  const [filters, setFilters] = useState<FilterType>({ sortBy: 'popular' });
  const [selectedAgent, setSelectedAgent] = useState<AgentTemplate | null>(null);
  const [deployAgent, setDeployAgent] = useState<AgentTemplate | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);

  const filteredAgents = useMemo(() => {
    let result = [...marketplaceAgents];

    if (filters.category) {
      result = result.filter(a => a.category === filters.category);
    }

    if (filters.pricing) {
      result = result.filter(a => a.pricing.model === filters.pricing);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(a => 
        a.name.toLowerCase().includes(searchLower) ||
        a.description.toLowerCase().includes(searchLower) ||
        a.tags.some(t => t.toLowerCase().includes(searchLower))
      );
    }

    if (filters.minRating) {
      result = result.filter(a => a.stats.avgRating >= filters.minRating!);
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

  const featuredAgents = marketplaceAgents.filter(a => a.featured);

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
    <div className="d3-os-shell min-h-screen bg-background">
      <D3vonnPageBanner title="Enterprise Agent Marketplace" />
      <div className="container mx-auto px-4 py-8 sm:px-6 sm:py-12">
        <section className="d3-chrome-panel mb-8 rounded-3xl p-6 sm:p-8">
          <div className="d3-system-status">Verified agent ecosystem</div>
          <h1 className="mt-4 text-3xl font-black text-white sm:text-5xl">Deploy specialized intelligence</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60 sm:text-base">Discover enterprise-ready agents by capability, industry, rating, and deployment model. Review each agent before connecting it to your organization.</p>
        </section>
        <MarketplaceHeader
          totalAgents={marketplaceAgents.length}
          featuredCount={featuredAgents.length}
          onPublishClick={handlePublishClick}
        />

        <div className="d3-chrome-panel rounded-2xl p-4 sm:p-6">
        <FeaturedAgents
          agents={featuredAgents}
          onView={handleViewAgent}
          onDeploy={handleDeployAgent}
        />

        </div>

        <div className="d3-chrome-panel mt-8 rounded-2xl p-4 sm:p-6">
        <MarketplaceFilters
          filters={filters}
          onFiltersChange={setFilters}
        />

        <div className="flex items-center justify-between my-6">
          <p className="text-sm text-muted-foreground">
            Showing <strong>{filteredAgents.length}</strong> agents
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onView={handleViewAgent}
              onDeploy={handleDeployAgent}
            />
          ))}
        </div>

        {filteredAgents.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold mb-2">No agents found</h3>
            <p className="text-muted-foreground">
              Try adjusting your filters or search terms
            </p>
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
    </div>
  );
};

export default AgentMarketplace;
