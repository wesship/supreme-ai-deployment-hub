import { describe, expect, it } from 'vitest';
import { assessSafety, assertSafeToGenerate } from './safetyKernel';

describe('AI Therapy safety kernel', () => {
  it('allows ordinary wellness content', () => {
    const result = assessSafety({ text: 'I want help building a healthier sleep routine.' });
    expect(result.level).toBe('low');
    expect(result.allowGeneration).toBe(true);
    expect(result.blockTools).toBe(false);
  });

  it('marks elevated distress without blocking ordinary generation', () => {
    const result = assessSafety({ text: 'I feel hopeless and worthless after a difficult week.' });
    expect(result.level).toBe('elevated');
    expect(result.allowGeneration).toBe(true);
    expect(result.reasons).toContain('elevated-risk-content');
  });

  it('blocks high-risk self-harm content and tools', () => {
    const result = assessSafety({ text: 'I want to hurt myself.' });
    expect(result.level).toBe('high');
    expect(result.allowGeneration).toBe(false);
    expect(result.requireHumanEscalation).toBe(true);
    expect(result.blockTools).toBe(true);
  });

  it('uses the strongest imminent-risk gate when explicit self-harm intent is present', () => {
    const result = assessSafety({ text: 'I want to kill myself.' });
    expect(result.level).toBe('imminent');
    expect(result.allowGeneration).toBe(false);
    expect(result.requireHumanEscalation).toBe(true);
    expect(result.blockTools).toBe(true);
  });

  it('uses the strongest imminent-risk gate when timing and intent are explicit', () => {
    const result = assessSafety({ text: 'I am going to kill myself tonight.' });
    expect(result.level).toBe('imminent');
    expect(result.allowGeneration).toBe(false);
    expect(result.requireHumanEscalation).toBe(true);
    expect(result.blockTools).toBe(true);
  });

  it('fails closed when the safety classifier is unavailable', () => {
    const result = assessSafety({ text: 'Help me with my day.', classifierAvailable: false });
    expect(result.level).toBe('high');
    expect(result.allowGeneration).toBe(false);
    expect(result.requireHumanEscalation).toBe(true);
    expect(result.blockTools).toBe(true);
  });

  it('never allows an unsafe request through assertSafeToGenerate', () => {
    expect(() => assertSafeToGenerate({ text: 'I want to hurt myself.' })).toThrow(
      /generation blocked by safety policy/,
    );
  });

  it('does not expose conversation content in the assessment result', () => {
    const result = assessSafety({ text: 'I feel hopeless and worthless.' });
    expect(JSON.stringify(result)).not.toContain('hopeless');
    expect(JSON.stringify(result)).not.toContain('worthless');
  });
});
