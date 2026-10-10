import type { Agent, AgentType, AgentsListResponse } from '@/types/agent';

const AGENT_TYPES = new Set<AgentType>([
  'researcher',
  'analyst',
  'writer',
  'coder',
  'planner',
  'executor',
  'critic',
  'custom',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return values.length > 0 ? values : undefined;
}

function agentType(value: unknown): AgentType {
  return typeof value === 'string' && AGENT_TYPES.has(value as AgentType)
    ? (value as AgentType)
    : 'custom';
}

export function normalizeAgentRecord(value: unknown, index = 0): Agent | null {
  if (!isRecord(value)) return null;

  const name = stringValue(value.name);
  if (!name) return null;

  const capabilities = stringArray(value.capabilities) ?? stringArray(value.skills);
  const status = stringValue(value.status);
  const description =
    stringValue(value.desc) ??
    stringValue(value.description) ??
    (status ? `${name} is ${status}` : `${name} agent`);

  return {
    id: stringValue(value.id) ?? name ?? `agent-${index}`,
    name,
    desc: description,
    type: agentType(value.type),
    capabilities,
    skills: stringArray(value.skills) ?? capabilities,
    tools: stringArray(value.tools),
    memory_enabled:
      typeof value.memory_enabled === 'boolean' ? value.memory_enabled : undefined,
  };
}

export function normalizeAgentsResponse(payload: unknown): AgentsListResponse {
  const source = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.agents)
      ? payload.agents
      : null;

  if (!source) {
    throw new Error('Agent API returned an unsupported response shape');
  }

  const agents = source
    .map((value, index) => normalizeAgentRecord(value, index))
    .filter((agent): agent is Agent => agent !== null);

  return { agents };
}
