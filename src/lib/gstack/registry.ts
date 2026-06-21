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
    requiredProof: 'Protected routes reject unsigned traffic and accept valid HMAC signatures.',
    blocksShip: true,
  },
  {
    key: 'hitl',
    label: 'Hermes HITL approval',
    requiredProof: 'Telegram/Hermes approval exists before high-impact actions.',
    blocksShip: true,
  },
];

const shippingGates = ['dns', 'health', 'ci', 'sentry', 'bundle', 'hmac'] as const;
const approvalRequiredActions = ['merge to main', 'run migration', 'production deploy'] as const;

export const GSTACK_AGENT_REGISTRY: readonly GStackAgentDefinition[] = [
  {
    command: '/release',
    name: 'Release',
    layer: 'shipping',
    role: 'PR ship and changelog owner',
    devonnContext: 'Railway deploy, Hostinger DNS gate, Sentry verification, and bundle budget enforcement.',
    defaultInputs: ['release candidate', 'changelog', 'gate evidence'],
    defaultOutputs: ['release notes', 'gate report', 'rollback plan'],
    allowedActions: ['prepare release notes', 'verify gates', 'recommend release readiness'],
    blockedWithoutApproval: approvalRequiredActions,
    requiredGates: shippingGates,
    status: 'active',
  },
  {
    command: '/ship',
    name: 'Ship',
    layer: 'shipping',
    role: 'Close issue and merge coordinator',
    devonnContext: 'Merges only after all required gates pass; never skips gate discipline.',
    defaultInputs: ['approved PR', 'gate evidence', 'rollback plan'],
    defaultOutputs: ['ship decision', 'merge checklist', 'post-ship monitoring plan'],
    allowedActions: ['evaluate merge readiness', 'close shipped issue', 'write handoff'],
    blockedWithoutApproval: approvalRequiredActions,
    requiredGates: [...shippingGates, 'hitl'],
    status: 'active',
  },
  {
    command: '/review',
    name: 'Reviewer',
    layer: 'shipping',
    role: 'Code and PR reviewer',
    devonnContext: 'Reviews PRs on wesship/supreme-ai-deployment-hub and related Wesship repositories.',
    defaultInputs: ['PR diff', 'acceptance criteria', 'gate status'],
    defaultOutputs: ['review findings', 'approval blockers', 'suggested patch'],
    allowedActions: ['review code', 'flag risks', 'recommend tests'],
    blockedWithoutApproval: approvalRequiredActions,
    requiredGates: ['ci', 'sentry'],
    status: 'active',
  },
];

export function getGStackAgent(command: string): GStackAgentDefinition | undefined {
  return GSTACK_AGENT_REGISTRY.find((agent) => agent.command === command.trim());
}

export function listGStackCommands(): readonly string[] {
  return GSTACK_AGENT_REGISTRY.map((agent) => agent.command);
}
