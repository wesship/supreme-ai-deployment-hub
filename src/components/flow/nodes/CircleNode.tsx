
import React, { memo } from 'react';
import { Handle, useStore, Position } from '@xyflow/react';

const CircleNode = memo(({ id }: { id: string }) => {
  const label = useStore((s) => {
    const node = s.nodeLookup.get(id);

    if (!node) {
      return null;
    }

    return `Position x:${parseInt(String(node.position.x))} y:${parseInt(
      String(node.position.y),
    )}`;
  });

  return (
    <div>
      <div>{label || 'no node connected'}</div>
      <Handle type="target" position={Position.Left} className='custom-handle' />
    </div>
  );
});

export default CircleNode;
