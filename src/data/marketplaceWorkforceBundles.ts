import { verifiedMarketplaceEcosystem } from './verifiedMarketplaceEcosystem';

export type MarketplaceBundle = {
  id: string;
  name: string;
  description: string;
  agentIds: string[];
  verification: 'verified';
};

const known = new Set(verifiedMarketplaceEcosystem.map((agent) => agent.id));

export const marketplaceWorkforceBundles: MarketplaceBundle[] = [
  { id: 'startup-intelligence', name: 'Startup Intelligence Stack', description: 'Market intelligence, brand strategy, web production, and video intelligence.', agentIds: ['agent-video-002', 'agent-video-001', 'agent-brandforge-002', 'agent-brandforge-001'], verification: 'verified' },
  { id: 'devops', name: 'D3VONN DevOps Stack', description: 'Infrastructure, Kubernetes, CI/CD, security, and workflow operations.', agentIds: ['agent-008', 'agent-002', 'agent-004', 'agent-001', 'agent-011'], verification: 'verified' },
  { id: 'enterprise-security', name: 'Enterprise Security Stack', description: 'Security monitoring, compliance, backups, and infrastructure resilience.', agentIds: ['agent-001', 'agent-010', 'agent-012', 'agent-002'], verification: 'verified' },
];

for (const bundle of marketplaceWorkforceBundles) {
  const missing = bundle.agentIds.filter((id) => !known.has(id));
  if (missing.length) throw new Error(`Marketplace bundle ${bundle.id} references unknown agents: ${missing.join(', ')}`);
}
