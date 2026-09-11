export type SafetyLevel = 'low' | 'elevated' | 'high' | 'imminent';

export type SafetyMode = 'wellness' | 'support' | 'clinical-gated';

export interface SafetyAssessment {
  level: SafetyLevel;
  allowGeneration: boolean;
  requireHumanEscalation: boolean;
  blockTools: boolean;
  reasons: string[];
  policyVersion: string;
}

export interface SafetyKernelInput {
  text: string;
  mode?: SafetyMode;
  classifierAvailable?: boolean;
}

const POLICY_VERSION = 'ai-therapy-safety-2026-08-20.1';

const imminentPatterns: RegExp[] = [
  /(?:kill|end)\s+(?:myself|my\s+life)/i,
  /suicid(?:e|al)\b.*\b(?:tonight|today|now)/i,
  /(?:i|i'm|i am)\s+(?:about to|going to|plan to)\s+(?:die|kill myself|hurt myself)/i,
  /(?:have|got)\s+(?:a|the)\s+(?:gun|weapon|pills?)\b.*\b(?:kill|hurt)\s+myself/i,
  /(?:already|just)\s+(?:took|swallowed)\s+(?:a|some)\s+(?:pills?|medication|poison)/i,
];

const highRiskPatterns: RegExp[] = [
  /\bsuicid(?:e|al|ality)\b/i,
  /\bkill\s+myself\b/i,
  /\bself[- ]?harm\b/i,
  /\bwant\s+to\s+die\b/i,
  /\bhurt\s+myself\b/i,
  /\b(?:kill|hurt)\s+(?:him|her|them|someone)\b/i,
  /\b(?:hearing|seeing)\s+(?:voices?|things?)\b/i,
  /\b(?:manic|mania|not\s+sleeping\s+for\s+days)\b/i,
];

const elevatedPatterns: RegExp[] = [
  /\bhopeless\b/i,
  /\bworthless\b/i,
  /\bcan't\s+go\s+on\b/i,
  /\bno\s+reason\s+to\s+live\b/i,
  /\bpanic\b/i,
  /\bcompuls(?:ion|ive)\b/i,
  /\bobsess(?:ion|ive)\b/i,
  /\b(?:drink|drinking|drug|drugs|overdose)\b/i,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function assessSafety(input: SafetyKernelInput): SafetyAssessment {
  const text = input.text.trim();

  if (input.classifierAvailable === false) {
    return {
      level: 'high',
      allowGeneration: false,
      requireHumanEscalation: true,
      blockTools: true,
      reasons: ['safety-classifier-unavailable'],
      policyVersion: POLICY_VERSION,
    };
  }

  if (!text) {
    return {
      level: 'low',
      allowGeneration: true,
      requireHumanEscalation: false,
      blockTools: false,
      reasons: [],
      policyVersion: POLICY_VERSION,
    };
  }

  if (matchesAny(text, imminentPatterns)) {
    return {
      level: 'imminent',
      allowGeneration: false,
      requireHumanEscalation: true,
      blockTools: true,
      reasons: ['possible-imminent-danger'],
      policyVersion: POLICY_VERSION,
    };
  }

  if (matchesAny(text, highRiskPatterns)) {
    return {
      level: 'high',
      allowGeneration: false,
      requireHumanEscalation: true,
      blockTools: true,
      reasons: ['high-risk-content'],
      policyVersion: POLICY_VERSION,
    };
  }

  if (matchesAny(text, elevatedPatterns)) {
    return {
      level: 'elevated',
      allowGeneration: true,
      requireHumanEscalation: false,
      blockTools: false,
      reasons: ['elevated-risk-content'],
      policyVersion: POLICY_VERSION,
    };
  }

  return {
    level: 'low',
    allowGeneration: true,
    requireHumanEscalation: false,
    blockTools: false,
    reasons: [],
    policyVersion: POLICY_VERSION,
  };
}

export function assertSafeToGenerate(input: SafetyKernelInput): SafetyAssessment {
  const assessment = assessSafety(input);

  if (!assessment.allowGeneration) {
    throw new Error(`AI Therapy generation blocked by safety policy ${assessment.policyVersion}`);
  }

  return assessment;
}
