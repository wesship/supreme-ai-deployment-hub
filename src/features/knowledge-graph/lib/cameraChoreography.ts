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


export type DepthAnchor = {
  x: number;
  y: number;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function deriveDepthAnchor(
  nodes: Node[],
  focusNodeIds: string[],
): DepthAnchor {
  const focusNodes = focusNodeIds
    .map((id) => nodes.find((node) => node.id === id))
    .filter((node): node is Node => Boolean(node));

  if (!focusNodes.length || !nodes.length) return { x: 0.5, y: 0.5 };

  const centerOf = (node: Node) => {
    const width = typeof node.measured?.width === 'number' ? node.measured.width : 210;
    const height = typeof node.measured?.height === 'number' ? node.measured.height : 110;
    return {
      x: node.position.x + width / 2,
      y: node.position.y + height / 2,
    };
  };

  const allCenters = nodes.map(centerOf);
  const focusCenters = focusNodes.map(centerOf);
  const minX = Math.min(...allCenters.map((point) => point.x));
  const maxX = Math.max(...allCenters.map((point) => point.x));
  const minY = Math.min(...allCenters.map((point) => point.y));
  const maxY = Math.max(...allCenters.map((point) => point.y));
  const focusX = focusCenters.reduce((sum, point) => sum + point.x, 0) / focusCenters.length;
  const focusY = focusCenters.reduce((sum, point) => sum + point.y, 0) / focusCenters.length;

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  // Keep the volumetric light away from hard viewport edges for readability.
  const x = 0.14 + clamp01((focusX - minX) / width) * 0.72;
  const y = 0.14 + clamp01((focusY - minY) / height) * 0.72;
  return { x, y };
}
