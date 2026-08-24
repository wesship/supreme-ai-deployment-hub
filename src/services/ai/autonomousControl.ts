/** D3VONN autonomous execution controls. Server-side callers should persist these states in the governance store. */

export type AutonomousState = 'running' | 'paused' | 'approval_required' | 'denied';

export interface AutonomousControl {
  enabled: boolean;
  state: AutonomousState;
  killSwitch: boolean;
  reason?: string;
}

export const DEFAULT_AUTONOMOUS_CONTROL: AutonomousControl = {
  enabled: true,
  state: 'running',
  killSwitch: false,
};

export function evaluateAutonomousControl(
  control: AutonomousControl,
  requiresApproval: boolean,
): { allowed: boolean; mode: AutonomousState; reason: string } {
  if (control.killSwitch || !control.enabled) {
    return { allowed: false, mode: 'paused', reason: control.reason || 'Autonomous execution is paused.' };
  }
  if (requiresApproval) {
    return { allowed: false, mode: 'approval_required', reason: 'Explicit approval is required before execution.' };
  }
  return { allowed: true, mode: 'running', reason: 'Autonomous execution is permitted.' };
}
