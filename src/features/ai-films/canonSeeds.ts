import type { CanonRule } from './canonSceneService';

export const sovereignSignalCanonSeeds: Array<Omit<CanonRule, 'id' | 'projectId'>> = [
  {
    ruleKey: 'legend-white-shirt',
    title: 'Legend wardrobe is immutable',
    description: 'Legend wears a plain white T-shirt only. No logos, color variants, or costume evolution.',
    appliesTo: ['character:legend', 'wardrobe', 'scene'],
    severity: 'blocking',
    validator: { requiredTerms: ['white t-shirt'], forbiddenTerms: ['logo shirt', 'black shirt', 'red shirt'] },
    active: true,
  },
  {
    ruleKey: 'door-is-alignment',
    title: 'The Door opens into alignment',
    description: 'The Door must not be reduced to an ordinary portal into a physical destination.',
    appliesTo: ['door', 'story', 'scene'],
    severity: 'error',
    validator: { forbiddenTerms: ['ordinary doorway', 'door to another room'] },
    active: true,
  },
  {
    ruleKey: 'residual-balance-side-effect',
    title: 'Residual Balance is not a power',
    description: 'Residual Balance remains a side effect of Legend’s alignment, never a controllable superpower.',
    appliesTo: ['legend', 'residual-balance', 'scene'],
    severity: 'blocking',
    validator: { forbiddenTerms: ['activates residual balance', 'uses residual balance power', 'casts residual balance'] },
    active: true,
  },
  {
    ruleKey: 'genesis-mode-sonic-law',
    title: 'Genesis Mode sonic law',
    description: 'Perfect Order uses clean harmonic intervals; Flaw introduces tritones, minor seconds, grain, and instability.',
    appliesTo: ['audio', 'music', 'scene'],
    severity: 'warning',
    validator: {},
    active: true,
  },
  {
    ruleKey: 'signal-vfx-restraint',
    title: 'Signal effects remain restrained',
    description: 'Signal phenomena should often register through behavior, timing, light, and sound before overt spectacle.',
    appliesTo: ['vfx', 'cinematography', 'scene'],
    severity: 'warning',
    validator: { forbiddenTerms: ['constant giant energy beam', 'continuous explosive portal effects'] },
    active: true,
  },
];
