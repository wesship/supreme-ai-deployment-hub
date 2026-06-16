import { registry as defaultRegistry } from './registry.js';
import type { ApprovalLevel, CommandDefinition, CommandRegistry, ParsedCommand } from './types.js';

const OUTPUT_CODES = new Set(['TABLE','JSON','YAML','MARKDOWN','MERMAID','FLOWCHART','TECHNICAL','BEGINNER']);

export function normalizeCode(value: string): string {
  return value.trim().toUpperCase().replace(/[\s_]+/g, '-').replace(/-+/g, '-');
}

function indexRegistry(registry: CommandRegistry) {
  const commands = new Map<string, CommandDefinition>();
  const aliases = new Map<string, string>();
  for (const command of registry.commands) {
    commands.set(command.code, command);
    for (const alias of command.aliases ?? []) aliases.set(normalizeCode(alias), command.code);
  }
  return { commands, aliases };
}

function expand(code: string, registry: CommandRegistry, stack: string[] = []): string[] {
  if (!registry.masterCodes[code]) return [code];
  if (stack.includes(code)) throw new Error(`Circular master code: ${[...stack, code].join(' -> ')}`);
  return registry.masterCodes[code].flatMap(child => expand(normalizeCode(child), registry, [...stack, code]));
}

export function parseCommand(raw: string, registry: CommandRegistry = defaultRegistry): ParsedCommand {
  const colon = raw.indexOf(':');
  const commandPart = colon >= 0 ? raw.slice(0, colon) : raw;
  const instruction = colon >= 0 ? raw.slice(colon + 1).trim() : '';
  const requestedCodes = commandPart.split('+').map(normalizeCode).filter(Boolean);
  const indexed = indexRegistry(registry);
  const resolved = requestedCodes.map(code => indexed.aliases.get(code) ?? code);
  const expandedCodes = [...new Set(resolved.flatMap(code => expand(code, registry)))];
  const unknownCodes = expandedCodes.filter(code => !indexed.commands.has(code));
  const known = expandedCodes.filter(code => indexed.commands.has(code));
  const conflicts: Array<{left:string;right:string}> = [];
  const seen = new Set<string>();
  for (const code of known) {
    const definition = indexed.commands.get(code)!;
    for (const conflict of definition.conflictsWith ?? []) {
      if (known.includes(conflict)) {
        const key = [code, conflict].sort().join('|');
        if (!seen.has(key)) { seen.add(key); conflicts.push({ left: code, right: conflict }); }
      }
    }
  }
  const approvalLevel = known.reduce<ApprovalLevel>((level, code) => {
    const next = indexed.commands.get(code)!.approvalLevel;
    return next > level ? next : level;
  }, 0);
  const licensedReviewRequired = known.includes('ESCALATE-LICENSED') || known.some(code => indexed.commands.get(code)?.regulated && indexed.commands.get(code)!.approvalLevel === 3);
  const humanApprovalRequired = licensedReviewRequired || known.includes('HUMAN-APPROVAL') || approvalLevel >= 2;
  const outputFormat = known.find(code => OUTPUT_CODES.has(code));
  return { raw, instruction, requestedCodes: resolved, expandedCodes, unknownCodes, conflicts, approvalLevel, humanApprovalRequired, licensedReviewRequired, outputFormat };
}

export { defaultRegistry as registry };
export { routeCommand, routedAgents } from './routing2.js';
export type { RoutedAgent } from './routing2.js';
export type { ApprovalLevel, CommandDefinition, CommandRegistry, ParsedCommand } from './types.js';
