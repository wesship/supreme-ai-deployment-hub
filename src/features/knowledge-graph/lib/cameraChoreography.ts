import type { Node } from '@xyflow/react';

export type CameraTarget = {
  x: number;
  y: number;
  zoom: number;
};

export function deriveCameraTarget(
  nodes: Node[],
  focusNodeIds: string[],
): CameraTarget | null {
  const focusNodes = focusNodeIds
    .map((id) => nodes.find((node) => node.id === id))
    .filter((node): node is Node => Boolean(node));

  if (!focusNodes.length) return null;

  const centers = focusNodes.map((node) => {
    const width = typeof node.measured?.width === 'number' ? node.measured.width : 210;
    const height = typeof node.measured?.height === 'number' ? node.measured.height : 110;
    return {
      x: node.position.x + width / 2,
      y: node.position.y + height / 2,
    };
  });

  const x = centers.reduce((sum, point) => sum + point.x, 0) / centers.length;
  const y = centers.reduce((sum, point) => sum + point.y, 0) / centers.length;

  const zoom =
    focusNodes.length === 1
      ? 1.08
      : focusNodes.length <= 3
        ? 0.96
        : 0.86;

  return { x, y, zoom };
}
