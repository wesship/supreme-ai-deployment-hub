/**
 * D3VONN Safe Autonomous Agent Policy
 *
 * Central guardrails for multi-agent execution. This module is intentionally
 * deterministic: model output may propose actions, but policy decides whether
 * an action is allowed, approval-gated, or denied.
 */

export type RiskTier = 'read' | 'write' | 'deploy' | 'destructive';
export type ApprovalMode = 'auto' | 'approval_required' | 'deny';

export interface AgentSafetyConfig {
  maxAgents: number;
  maxDepth: number;
  maxToolCallsPerRun: number;
  maxRunMinutes: number;
  maxEstimatedCostUsd: number;
  requireApprovalForProduction: boolean;
  requireApprovalForDestructive: boolean;
}

export const DEFAULT_AGENT_SAFETY: AgentSafetyConfig = {
  maxAgents: 5,
  maxDepth: 3,
  maxToolCallsPerRun: 40,
  maxRunMinutes: 30,
  maxEstimatedCostUsd: 10,
  requireApprovalForProduction: true,
  requireApprovalForDestructive: true,
};

/** Tools are classified independently of model intent. */
export const TOOL_RISK: Record<string, RiskTier> = {
  get_deployment_status: 'read',
  get_github_workflow_status: 'read',
  get_system_metrics: 'read',
  search_documentation: 'read',
  spawn_agent: 'write',
  execute_workflow: 'write',
  trigger_github_workflow: 'deploy',
};

const DESTRUCTIVE_PATTERNS = /delete|destroy|drop|truncate|purge|revoke|rotate[_ -]?secret|force[- ]?push/i;
const PRODUCTION_PATTERNS = /production|prod\b|live|release|promote/i;

export function evaluateToolAction(
  toolName: string,
  args: Record<string, unknown>,
  config: AgentSafetyConfig = DEFAULT_AGENT_SAFETY,
): { mode: ApprovalMode; reason: string } {
  const tier = TOOL_RISK[toolName];
  if (!tier) return { mode: 'deny', reason: `Tool is not allowlisted: ${toolName}` };

  const serializedArgs = JSON.stringify(args);

  if (DESTRUCTIVE_PATTERNS.test(serializedArgs)) {
    return config.requireApprovalForDestructive
      ? { mode: 'approval_required', reason: 'Destructive operation requires explicit approval.' }
      : { mode: 'auto', reason: 'Destructive operation allowed by configured policy.' };
  }

  if (tier === 'deploy' && config.requireApprovalForProduction && PRODUCTION_PATTERNS.test(serializedArgs)) {
    return { mode: 'approval_required', reason: 'Production deployment requires explicit approval.' };
  }

  if (tier === 'deploy') {
    return { mode: 'approval_required', reason: 'Deployment actions require explicit approval.' };
  }

  return { mode: 'auto', reason: 'Read/write action is within the autonomous allowlist.' };
}

export function validateAgentBudget(
  activeAgents: number,
  depth: number,
  toolCalls: number,
  startedAtMs: number,
  estimatedCostUsd: number,
  config: AgentSafetyConfig = DEFAULT_AGENT_SAFETY,
): { allowed: boolean; reason?: string } {
  if (activeAgents > config.maxAgents) return { allowed: false, reason: 'Maximum agent count exceeded.' };
  if (depth > config.maxDepth) return { allowed: false, reason: 'Maximum agent depth exceeded.' };
  if (toolCalls > config.maxToolCallsPerRun) return { allowed: false, reason: 'Maximum tool-call budget exceeded.' };
  if (Date.now() - startedAtMs > config.maxRunMinutes * 60_000) return { allowed: false, reason: 'Maximum run time exceeded.' };
  if (estimatedCostUsd > config.maxEstimatedCostUsd) return { allowed: false, reason: 'Estimated AI spend exceeds the configured run budget.' };
  return { allowed: true };
}

export function redactSensitiveText(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,}]+/gi, '$1=[REDACTED]');
}
