import type { AgentTemplate } from '@/types/marketplace';

export interface MarketplaceBundle { id: string; name: string; description: string; agentIds: string[]; pricing: { model: 'subscription'; amount: number; currency: 'USD'; interval: 'monthly' }; }

export const marketplaceBundles: MarketplaceBundle[] = [
  { id: 'startup-intelligence', name: 'Startup Intelligence Stack', description: 'Research, positioning, brand production, and video intelligence for startups.', agentIds: ['agent-video-002', 'agent-video-001', 'agent-brandforge-002', 'agent-brandforge-001'], pricing: { model: 'subscription', amount: 499, currency: 'USD', interval: 'monthly' } },
  { id: 'devops', name: 'D3VONN DevOps Stack', description: 'Infrastructure operations, Kubernetes, CI/CD, security, and workflow automation.', agentIds: ['agent-008', 'agent-002', 'agent-004', 'agent-001', 'agent-011'], pricing: { model: 'subscription', amount: 399, currency: 'USD', interval: 'monthly' } },
  { id: 'enterprise-security', name: 'Enterprise Security Stack', description: 'Security monitoring, compliance, backup verification, and infrastructure recovery.', agentIds: ['agent-001', 'agent-010', 'agent-012', 'agent-002'], pricing: { model: 'subscription', amount: 449, currency: 'USD', interval: 'monthly' } },
];

export function resolveBundleAgents(bundle: MarketplaceBundle, agents: AgentTemplate[]): AgentTemplate[] {
  return bundle.agentIds.map((id) => agents.find((agent) => agent.id === id)).filter((agent): agent is AgentTemplate => Boolean(agent));
}
