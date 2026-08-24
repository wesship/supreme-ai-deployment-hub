import { describe, expect, it } from 'vitest';
import { evaluateToolAction, validateAgentBudget } from './safetyPolicy';
import { evaluateAutonomousControl } from './autonomousControl';

describe('autonomous safety boundaries', () => {
  it('denies unknown tools', () => {
    expect(evaluateToolAction('shell_exec', {}).mode).toBe('deny');
  });

  it('requires approval for deployments', () => {
    expect(evaluateToolAction('trigger_github_workflow', { branch: 'main' }).mode).toBe('approval_required');
  });

  it('requires approval for destructive intent', () => {
    expect(evaluateToolAction('execute_workflow', { workflow_name: 'delete-data' }).mode).toBe('approval_required');
  });

  it('stops runs over cost budget', () => {
    expect(validateAgentBudget(1, 1, 1, Date.now(), 11).allowed).toBe(false);
  });

  it('honors the global kill switch', () => {
    const result = evaluateAutonomousControl({ enabled: true, state: 'running', killSwitch: true }, false);
    expect(result.allowed).toBe(false);
    expect(result.mode).toBe('paused');
  });
});
