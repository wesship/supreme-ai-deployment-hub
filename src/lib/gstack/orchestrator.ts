import { routeGStackCommand } from './commandRouter';
import { evaluateGStackGates, type GStackGateEvidence } from './gateEngine';
import type { GStackCommandDecision, GStackCommandRequest } from './agentTypes';

export interface GStackWorkflowStep {
  readonly request: GStackCommandRequest;
  readonly decision: GStackCommandDecision;
}

export interface GStackWorkflowPlan {
  readonly objective: string;
  readonly steps: readonly GStackWorkflowStep[];
  readonly canShip: boolean;
  readonly gateSummary: string;
}

const defaultDeliveryFlow = ['/plan','/eng-manager','/build','/review','/qa','/security','/release','/ship'] as const;

export function createGStackDeliveryWorkflow(objective: string, evidence: readonly GStackGateEvidence[] = []): GStackWorkflowPlan {
  const gateReport = evaluateGStackGates(evidence);
  const steps = defaultDeliveryFlow.map((command) => {
    const request: GStackCommandRequest = {
      command,
      objective,
      targetEnvironment: command === '/ship' || command === '/release' ? 'production' : 'staging',
      requiresDestructiveAction: command === '/ship',
    };
    return {
      request,
      decision: routeGStackCommand(request),
    };
  });

  return {
    objective,
    steps,
    canShip: gateReport.canShip,
    gateSummary: gateReport.summary,
  };
}
