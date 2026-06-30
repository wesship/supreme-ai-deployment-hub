import type { GStackAgentDefinition, GStackGateRequirement } from './agentTypes';

export const GSTACK_GATE_REQUIREMENTS: readonly GStackGateRequirement[] = [
  {
    key: 'dns',
    label: 'DNS delegation',
    requiredProof: 'Hostinger DNS zone evidence for d3vonn.io, www.d3vonn.io, and api.d3vonn.io, plus public api.d3vonn.io resolution.',
    blocksShip: true,
  },
  {
    key: 'health',
    label: 'Backend health',
    requiredProof: 'curl https://api.d3vonn.io/health returns HTTP 200 OK.',
    blocksShip: true,
  },
  {
    key: 'ci',
    label: 'GitHub Actions CI',
    requiredProof: 'All required GitHub Actions checks pass on the target commit.',
    blocksShip: true,
  },
  {
    key: 'sentry',
    label: 'Sentry clean',
    requiredProof: 'No new production error spike exists after deployment verification.',
    blocksShip: true,
  },
  {
    key: 'bundle',
    label: 'Bundle size',
    requiredProof: 'Production frontend bundle remains below 900KB gzip target.',
    blocksShip: true,
  },
  {
    key: 'hmac',
    label: 'Zero-Trust HMAC',
    requiredProof: 'HMAC verification evidence exists for protected routes.',
    blocksShip: true,
  },
  {
    key: 'hitl',
    label: 'Hermes HITL approval',
    requiredProof: 'Human approval evidence exists before high-impact actions.',
    blocksShip: true,
  },
];

const shippingGates = ['dns', 'health', 'ci', 'sentry', 'bundle', 'hmac'] as const;
const approvalRequiredActions = ['merge to main', 'run migration', 'production deploy'] as const;

function agent(
  command: string,
  name: string,
  layer: GStackAgentDefinition['layer'],
  role: string,
  requiredGates: readonly GStackGateRequirement['key'][] = []
): GStackAgentDefinition {
  return {
    command,
    name,
    layer,
    role,
    d3vonnContext: 'D3VONN.IO d3vonn.io platform operations, repository workflow, and agent coordination.',
    defaultInputs: ['objective', 'context', 'constraints'],
    defaultOutputs: ['recommendation', 'next steps', 'evidence'],
    allowedActions: ['review', 'plan', 'summarize', 'recommend'],
    blockedWithoutApproval: approvalRequiredActions,
    requiredGates,
    status: command.includes('ios') ? 'standby' : 'active',
  };
}

export const GSTACK_AGENT_REGISTRY: readonly GStackAgentDefinition[] = [
  agent('/ceo', 'CEO', 'strategic', 'Product vision and POL loop owner'),
  agent('/plan', 'Planner', 'strategic', 'RIPE spec writer'),
  agent('/office-hours', 'Office Hours', 'strategic', 'Idea pressure-test partner'),
  agent('/eng-manager', 'Engineering Manager', 'engineering', 'Architecture lock and technical sequencing', ['ci']),
  agent('/build', 'Builder', 'engineering', 'Implementation agent', ['ci']),
  agent('/pair-agent', 'Pair Agent', 'engineering', 'Coding partner', ['ci']),
  agent('/plan-devex', 'Developer Experience Planner', 'engineering', 'DX review'),
  agent('/plan-eng', 'Engineering Planner', 'engineering', 'Pre-change architecture reviewer', ['ci']),
  agent('/designer', 'Designer', 'design', 'UI and UX review partner', ['bundle']),
  agent('/plan-design', 'Design Planner', 'design', 'Design review', ['bundle']),
  agent('/ios-design-review', 'iOS Design Reviewer', 'design', 'iOS interface review', ['bundle']),
  agent('/qa', 'QA', 'quality-security', 'Real browser QA and gate validation', ['dns', 'health', 'ci']),
  agent('/ios-qa', 'iOS QA', 'quality-security', 'iPhone IDE QA', ['ci']),
  agent('/ios-fix', 'iOS Fixer', 'quality-security', 'iOS issue resolution agent', ['ci']),
  agent('/ios-clean', 'iOS Cleaner', 'quality-security', 'iOS cleanup', ['ci']),
  agent('/ios-sync', 'iOS Sync', 'quality-security', 'iOS/runtime sync', ['ci']),
  agent('/security', 'Security', 'quality-security', 'Application control reviewer', ['hmac', 'ci', 'sentry']),
  agent('/investigate', 'Investigator', 'quality-security', 'Debug deep dives'),
  {
    ...agent('/release', 'Release', 'shipping', 'PR ship and changelog owner', shippingGates),
    d3vonnContext: 'Railway deploy, Hostinger DNS gate, Sentry verification, and bundle budget enforcement.',
    defaultInputs: ['release candidate', 'changelog', 'gate evidence'],
    defaultOutputs: ['release notes', 'gate report', 'rollback plan'],
    allowedActions: ['prepare release notes', 'verify gates', 'recommend release readiness'],
  },
  agent('/ship', 'Ship', 'shipping', 'Close issue and merge coordinator', [...shippingGates, 'hitl']),
  agent('/plan-ceo-review', 'CEO Review Planner', 'shipping', 'CEO sign-off preparation', shippingGates),
  agent('/review', 'Reviewer', 'shipping', 'Code and PR reviewer', ['ci', 'sentry']),
  agent('/retro', 'Retro', 'shipping', 'Weekly retrospective'),
];

export function getGStackAgent(command: string): GStackAgentDefinition | undefined {
  return GSTACK_AGENT_REGISTRY.find((item) => item.command === command.trim());
}

export function listGStackCommands(): readonly string[] {
  return GSTACK_AGENT_REGISTRY.map((item) => item.command);
}
