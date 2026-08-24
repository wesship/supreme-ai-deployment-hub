import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AGENT_SAFETY,
  evaluateToolAction,
  validateAgentBudget,
  redactSensitiveText,
} from './safetyPolicy';

describe('D3VONN autonomous agent safety policy', () => {
  it('allows read-only tools automatically', () => {
    expect(evaluateToolAction('get_system_metrics', {})).toMatchObject({ mode: 'auto' });
  });

  it('requires approval for deployment', () => {
    expect(evaluateToolAction('trigger_github_workflow', { workflow: 'deploy.yml', branch: 'main' })).toMatchObject({
      mode: 'approval_required',
    });
  });

  it('requires approval for destructive intent', () => {
    expect(evaluateToolAction('execute_workflow', { workflow_name: 'delete-production-data' })).toMatchObject({
      mode: 'approval_required',
    });
  });

  it('denies unknown tools', () => {
    expect(evaluateToolAction('shell_exec', {})).toMatchObject({ mode: 'deny' });
  });

  it('enforces agent, depth, tool, time and cost budgets', () => {
    expect(validateAgentBudget(6, 1, 1, Date.now(), 1)).toMatchObject({ allowed: false });
    expect(validateAgentBudget(1, DEFAULT_AGENT_SAFETY.maxDepth + 1, 1, Date.now(), 1)).toMatchObject({ allowed: false });
    expect(validateAgentBudget(1, 1, DEFAULT_AGENT_SAFETY.maxToolCallsPerRun + 1, Date.now(), 1)).toMatchObject({ allowed: false });
    expect(validateAgentBudget(1, 1, 1, Date.now() - 31 * 60_000, 1)).toMatchObject({ allowed: false });
    expect(validateAgentBudget(1, 1, 1, Date.now(), DEFAULT_AGENT_SAFETY.maxEstimatedCostUsd + 1)).toMatchObject({ allowed: false });
  });

  it('redacts common credentials from audit text', () => {
    expect(redactSensitiveText('Bearer abc123 token=secret123')).toContain('[REDACTED]');
    expect(redactSensitiveText('Bearer abc123 token=secret123')).not.toContain('secret123');
  });
});
