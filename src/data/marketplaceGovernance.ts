import type { AgentCompatibility, AgentManifest, AgentPermission, AgentTemplate, AgentVerification } from '@/types/marketplace';

const permission = (key: string, label: string, risk: AgentPermission['risk'], required = true): AgentPermission => ({
  key,
  label,
  risk,
  required,
  description: `${label} permission requested by this agent.`,
});

export const defaultGovernanceManifest: AgentManifest = {
  schemaVersion: '1.0',
  publisher: 'D3VONN.IO',
  capabilities: [],
  permissions: [],
  dependencies: [],
  integrations: [],
  dataRequirements: [],
  updatePolicy: 'approval-required',
  rollbackSupported: false,
};

export const unverifiedAgentVerification: AgentVerification = {
  level: 'unverified',
  score: 0,
  security: 0,
  reliability: 0,
  documentation: 0,
  capabilityAccuracy: 0,
  permissionsReviewed: false,
  dataHandlingReviewed: false,
};

export function getAgentVerification(agent: AgentTemplate): AgentVerification {
  return agent.verification ?? unverifiedAgentVerification;
}

export function getAgentManifest(agent: AgentTemplate): AgentManifest {
  return agent.manifest ?? {
    ...defaultGovernanceManifest,
    capabilities: agent.capabilities,
    integrations: agent.integrations ?? [],
    permissions: [permission('knowledge.read', 'Read approved knowledge', 'low')],
  };
}

/** Conservative metadata-only compatibility gate. It never authorizes installation or execution. */
export function assessCompatibility(agent: AgentTemplate, availableIntegrations: string[] = []): AgentCompatibility {
  const manifest = getAgentManifest(agent);
  const missingDependencies = manifest.dependencies
    .filter((dependency) => dependency.required && dependency.healthy !== true)
    .map((dependency) => `${dependency.name}${dependency.version ? ` ${dependency.version}` : ''}`);
  const missingIntegrations = manifest.integrations.filter((integration) => !availableIntegrations.includes(integration));
  const warnings = manifest.permissions
    .filter((requestedPermission) => requestedPermission.risk === 'high' || requestedPermission.risk === 'critical')
    .map((requestedPermission) => `Elevated permission: ${requestedPermission.label}`);
  const missing = [...missingDependencies, ...missingIntegrations.map((integration) => `Integration: ${integration}`)];
  const requiredCount = manifest.dependencies.filter((dependency) => dependency.required).length + manifest.integrations.length;
  const score = requiredCount === 0 ? 100 : Math.max(0, Math.round(((requiredCount - missing.length) / requiredCount) * 100));
  return {
    score,
    compatible: missing.length === 0,
    missing,
    warnings,
    satisfied: [
      ...manifest.dependencies.filter((dependency) => dependency.required && dependency.healthy === true).map((dependency) => dependency.name),
      ...manifest.integrations.filter((integration) => availableIntegrations.includes(integration)),
    ],
  };
}
