import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('Neural Nexus sharpness contract', () => {
  const css = fs.readFileSync('src/styles/knowledge-graph-effects.css', 'utf8');

  it('keeps the command center visually crisp rather than heavily blurred', () => {
    expect(css).toContain('Neural Nexus sharpness pass');
    expect(css).toContain('backdrop-filter: none');
    expect(css).toContain('text-rendering: optimizeLegibility');
    expect(css).toContain('shape-rendering: geometricPrecision');
  });

  it('keeps the approved dark metal and warm gold signal treatment', () => {
    expect(css).toContain('#080806');
    expect(css).toContain('#fcd34d');
    expect(css).toContain('#fff7d6');
  });
});
