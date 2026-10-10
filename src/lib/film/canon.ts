export interface CanonRule {
  key: string;
  type: 'required' | 'forbidden' | 'reference' | 'event_lock';
  description: string;
  severity: 'advisory' | 'warning' | 'blocking';
  data?: Record<string, unknown>;
}

export interface CanonValidationResult {
  valid: boolean;
  blockingViolations: CanonRule[];
  warnings: CanonRule[];
}

export const SOVEREIGN_SIGNAL_CANON: CanonRule[] = [
  {
    key: 'legend-white-shirt',
    type: 'required',
    description: 'Legend wears a plain white T-shirt only, with no logos or alternate colors.',
    severity: 'blocking',
  },
  {
    key: 'legend-centered',
    type: 'required',
    description: 'Legend remains centered and visually stable in canonical hero framing.',
    severity: 'warning',
  },
  {
    key: 'nana-visual-identity',
    type: 'required',
    description: 'Nana wears white garments and a headwrap, with candlelight and matriarchal presence.',
    severity: 'blocking',
  },
  {
    key: 'visual-language',
    type: 'reference',
    description: 'Prestige science-fiction, metaphysical technology, Egyptian symbolism, and controlled blue-chrome accents.',
    severity: 'warning',
  },
  {
    key: 'ss-ie-jl-001',
    type: 'event_lock',
    description: 'SS-IE-J/L-001 outcome is immutable: Instance survives, the ritual fails, and human contact interrupts the event.',
    severity: 'blocking',
  },
];

export function buildCanonSnapshot(rules: CanonRule[] = SOVEREIGN_SIGNAL_CANON) {
  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    rules,
  };
}

export function validateCanonAcknowledgement(
  acknowledgedRuleKeys: string[],
  rules: CanonRule[] = SOVEREIGN_SIGNAL_CANON,
): CanonValidationResult {
  const missing = rules.filter((rule) => !acknowledgedRuleKeys.includes(rule.key));
  const blockingViolations = missing.filter((rule) => rule.severity === 'blocking');
  const warnings = missing.filter((rule) => rule.severity !== 'blocking');
  return { valid: blockingViolations.length === 0, blockingViolations, warnings };
}
