import type { ParsedCommand } from './types.js';
import { registry } from './registry.js';

export type RoutedAgent = { id: string; categories: string[] };

export const routedAgents: RoutedAgent[] = [
  { id: 'primetime-supervisor', categories: ['project','analysis','format'] },
  { id: 'concept-intelligence', categories: ['concept'] },
  { id: 'crm-architect', categories: ['crm'] },
  { id: 'policy-reviewer', categories: ['compliance','control'] },
  { id: 'automation-engineer', categories: ['automation'] },
  { id: 'agent-architect', categories: ['agent'] },
  { id: 'sales-operations', categories: ['sales','messaging'] },
  { id: 'security-reviewer', categories: ['security'] },
  { id: 'software-engineer', categories: ['development'] },
  { id: 'business-analyst', categories: ['analytics'] }
];

export function routeCommand(parsed: ParsedCommand) {
  const definitions = new Map(registry.commands.map(command => [command.code, command]));
  const categories = parsed.expandedCodes.map(code => definitions.get(code)?.category).filter(Boolean) as string[];
  const ranked = routedAgents.map(agent => ({ agent, score: agent.categories.filter(category => categories.includes(category)).length })).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.agent.id.localeCompare(b.agent.id));
  const blocked = parsed.unknownCodes.length > 0 || parsed.conflicts.length > 0;
  return {
    primaryAgent: ranked[0]?.agent ?? routedAgents[0],
    supportingAgents: ranked.slice(1).map(item => item.agent),
    status: blocked ? 'blocked' : parsed.humanApprovalRequired ? 'review-required' : 'draft-ready'
  };
}
