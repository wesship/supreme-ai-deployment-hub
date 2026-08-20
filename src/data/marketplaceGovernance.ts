import type { AgentCompatibility, AgentManifest, AgentPermission, AgentTemplate, AgentVerification } from '@/types/marketplace';

const permission = (key: string, label: string, risk: AgentPermission['risk'], required = true): AgentPermission => ({ key, label, risk, required, description: `${label} permission requested by this agent.` });

export const defaultGovernanceManifest: AgentManifest = {
  schemaVersion: '1.0', publisher: 'D3VONN.IO', capabilities: ['monitoring'],
  permissions: [permission('knowledge.read', 'Read approved knowledge', 'low')],
  dependencies: [], integrations: [], dataRequirements: ['Approved organizational data only'],
  updatePolicy: 'approval-required', rollbackSupported: true,
};

export const defaultVerification: AgentVerification = {
  level: 'reviewed', score: 85, security: 85, reliability: 85, documentation: 85,
  capabilityAccuracy: 85, permissionsReviewed: true, dataHandlingReviewed: true,
};

export function getAgentVerification(agent: AgentTemplate): AgentVerification {
  return agent.verification ?? defaultVerification;
}

export function getAgentManifest(agent: AgentTemplate): AgentManifest {
  return agent.manifest ?? { ...defaultGovernanceManifest, capabilities: agent.capabilities, integrations: agent.integrations ?? [], permissions: [permission('knowledge.read', 'Read approved knowledge', 'low')] };
}

/** Conservative compatibility gate: a listing is deployable only when all required dependencies are healthy. */
export function assessCompatibility(agent: AgentTemplate, availableIntegrations: string[] = []): AgentCompatibility {
  const manifest = getAgentManifest(agent);
  const missing = manifest.dependencies.filter((d) => d.required && d.healthy === false).map((d) => `${d.name}${d.version ? ` ${d.version}` : ''}`);
  const requiredIntegrations = manifest.integrations.filter((integration) => !availableIntegrations.includes(integration));
  const warnings = manifest.permissions.filter((p) => p.risk === 'high' || p.risk === 'critical').map((p) => `Elevated permission: ${p.label}`);
  const unsatisfied = missing.length + requiredIntegrations.length;
  const total = Math.max(1, manifest.dependencies.filter((d) => d.required).length + manifest.integrations.length);
  const score = Math.max(0, Math.round(((total - unsatisfied) / total) * 100));
  return { score, compatible: unsatisfied === 0, missing: [...missing, ...requiredIntegrations.map((i) => `Integration: ${i}`)], warnings, satisfied: [...manifest.dependencies.filter((d) => d.required && d.healthy !== false).map((d) => d.name), manifest.integrations.filter((i) => availableIntegrations.includes(i))] };
}
