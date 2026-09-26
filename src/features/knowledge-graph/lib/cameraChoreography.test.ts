import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';
import { deriveCameraTarget } from './cameraChoreography';

const nodes: Node[] = [
  { id: 'knowledge', position: { x: 560, y: 210 }, data: {} },
  { id: 'workflow', position: { x: 860, y: 95 }, data: {} },
  { id: 'films', position: { x: 1130, y: 15 }, data: {} },
];

describe('deriveCameraTarget', () => {
  it('focuses one node with a closer zoom', () => {
    const target = deriveCameraTarget(nodes, ['knowledge']);
    expect(target).toMatchObject({ zoom: 1.08 });
    expect(target?.x).toBeCloseTo(665);
    expect(target?.y).toBeCloseTo(265);
  });

  it('centers a multi-node corridor with a wider zoom', () => {
    const target = deriveCameraTarget(nodes, ['knowledge', 'workflow', 'films']);
    expect(target).toMatchObject({ zoom: 0.96 });
    expect(target?.x).toBeGreaterThan(700);
    expect(target?.x).toBeLessThan(1100);
  });

  it('returns null for unknown focus nodes', () => {
    expect(deriveCameraTarget(nodes, ['missing'])).toBeNull();
  });
});
