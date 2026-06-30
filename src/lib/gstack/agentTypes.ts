export type GStackLayer =
  | 'strategic'
  | 'engineering'
  | 'design'
  | 'quality-security'
  | 'shipping';

export type GStackAgentStatus = 'active' | 'blocked' | 'standby';

export type GStackGateKey =
  | 'dns'
  | 'health'
  | 'ci'
  | 'sentry'
  | 'bundle'
  | 'hmac'
  | 'hitl';

export interface GStackGateRequirement {
  readonly key: GStackGateKey;
  readonly label: string;
  readonly requiredProof: string;
  readonly blocksShip: boolean;
}

export interface GStackAgentDefinition {
  readonly command: string;
  readonly name: string;
  readonly layer: GStackLayer;
  readonly role: string;
  readonly d3vonnContext: string;
  readonly defaultInputs: readonly string[];
  readonly defaultOutputs: readonly string[];
  readonly allowedActions: readonly string[];
  readonly blockedWithoutApproval: readonly string[];
  readonly requiredGates: readonly GStackGateKey[];
  readonly status: GStackAgentStatus;
}

export interface GStackCommandRequest {
  readonly command: string;
  readonly objective: string;
  readonly operator?: string;
  readonly issueUrl?: string;
  readonly pullRequestUrl?: string;
  readonly targetEnvironment?: 'local' | 'staging' | 'production';
  readonly requiresDestructiveAction?: boolean;
}

export interface GStackCommandDecision {
  readonly accepted: boolean;
  readonly agent?: GStackAgentDefinition;
  readonly reason: string;
  readonly requiredProof: readonly string[];
  readonly nextActions: readonly string[];
}
