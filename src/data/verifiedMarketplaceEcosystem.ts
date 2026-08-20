import { AgentTemplate } from '@/types/marketplace';
import { mockAgentTemplates } from './mockAgentTemplates';
import { brandForgeAgentTemplates } from './brandForgeLayer';
import { videoProductionAgentTemplates } from './videoIntelligenceLayer';

/**
 * Canonical Marketplace presentation layer for the already verified 16-agent ecosystem.
 * Existing agents remain sourced from their domain data modules; this layer adds the
 * verified Marketplace metadata/feature flags without creating a second catalog.
 */
const verifiedUpdates: Record<string, Partial<AgentTemplate>> = {
  'agent-006': { featured: true },
  'agent-003': { featured: true },
  'agent-009': { featured: true },
  'agent-008': { featured: true },
  'agent-011': { featured: true },
};

const videoStartupAnalyst: AgentTemplate = {
  id: 'agent-video-002',
  name: 'Video Startup Analyst',
  slug: 'video-startup-analyst',
  description: 'Analyzes GenAI video startups, funding rounds, valuation signals, investors, founders, product categories, and D3VONN market gaps.',
  longDescription: 'Video Startup Analyst turns the verified GenAI video competitive-intelligence dataset into structured startup, funding, valuation, investor, founder, product, and market-gap analysis.',
  category: 'analytics',
  capabilities: ['reporting', 'ml-powered', 'monitoring', 'scheduling'],
  pricing: { model: 'subscription', amount: 99, currency: 'USD', interval: 'monthly' },
  author: { id: 'devonn', name: 'D3VONN.IO', verified: true, agentCount: 16 },
  status: 'published',
  version: '1.0.0',
  icon: '📈',
  tags: ['genai-video', 'startup-research', 'funding', 'valuation', 'investors', 'founders', 'market-gaps'],
  requirements: ['Access to the approved video startup intelligence dataset'],
  integrations: ['OpenMontage', 'DKOS', 'D3VONN Command Center'],
  stats: { downloads: 0, activeInstalls: 0, avgRating: 5.0, reviewCount: 0, lastUpdated: '2026-08-20' },
  createdAt: '2026-08-20',
  updatedAt: '2026-08-20',
  featured: true,
};

const verifiedAgentOverrides = [
  ...brandForgeAgentTemplates,
  ...videoProductionAgentTemplates,
  ...mockAgentTemplates,
].map((agent) => ({ ...agent, ...(verifiedUpdates[agent.id] ?? {}) }));

const canonicalAgents = [...verifiedAgentOverrides, videoStartupAnalyst];

// Fail fast during development if a Marketplace listing is accidentally duplicated.
const duplicateIds = canonicalAgents
  .map((agent) => agent.id)
  .filter((id, index, ids) => ids.indexOf(id) !== index);
if (duplicateIds.length > 0) {
  throw new Error(`Duplicate Marketplace agent IDs: ${[...new Set(duplicateIds)].join(', ')}`);
}

export const verifiedMarketplaceEcosystem: AgentTemplate[] = canonicalAgents;
export const verifiedMarketplaceAgentCount = verifiedMarketplaceEcosystem.length;
export const verifiedMarketplaceFeaturedCount = verifiedMarketplaceEcosystem.filter((agent) => agent.featured).length;

if (verifiedMarketplaceAgentCount !== 16) {
  throw new Error(`Marketplace ecosystem integrity failure: expected 16 agents, found ${verifiedMarketplaceAgentCount}`);
}
