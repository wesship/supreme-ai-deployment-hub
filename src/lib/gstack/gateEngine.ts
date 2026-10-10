import { GSTACK_GATE_REQUIREMENTS } from './registry';
import type { GStackGateKey } from './agentTypes';

export type GStackGateState = 'unknown' | 'red' | 'yellow' | 'green';

export interface GStackGateEvidence {
  readonly gate: GStackGateKey;
  readonly state: GStackGateState;
  readonly proof?: string;
  readonly checkedAt?: string;
  readonly source?: string;
}

export interface GStackGateReport {
  readonly canShip: boolean;
  readonly required: readonly GStackGateEvidence[];
  readonly missingProof: readonly GStackGateKey[];
  readonly summary: string;
}

export function evaluateGStackGates(evidence: readonly GStackGateEvidence[]): GStackGateReport {
  const required = GSTACK_GATE_REQUIREMENTS.filter((gate) => gate.blocksShip).map((gate) => {
    const match = evidence.find((item) => item.gate === gate.key);
    return match ?? { gate: gate.key, state: 'unknown' as const };
  });

  const missingProof = required
    .filter((item) => item.state !== 'green' || !item.proof)
    .map((item) => item.gate);

  return {
    canShip: missingProof.length === 0,
    required,
    missingProof,
    summary: missingProof.length === 0
      ? 'All required gates have proof. Shipping may proceed subject to operator approval.'
      : `Shipping blocked. Missing proof for: ${missingProof.join(', ')}`,
  };
}

export function createUnverifiedGateEvidence(): readonly GStackGateEvidence[] {
  return GSTACK_GATE_REQUIREMENTS.map((gate) => ({
    gate: gate.key,
    state: 'unknown' as const,
  }));
}
