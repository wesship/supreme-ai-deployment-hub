
import React, { Fragment, memo } from 'react';
import { Handle, useStore, Position, useReactFlow } from '@xyflow/react';

const dimensionAttrs = ['width', 'height'];

const TextInputNode = memo(({ id }: { id: string }) => {
  const { setNodes } = useReactFlow();
  const dimensions = useStore((s) => {
    const node = s.nodeLookup.get('2-3');
    if (
      !node ||
      !node.measured.width ||
      !node.measured.height ||
      !s.edges.some((edge) => edge.target === id)
    ) {
      return null;
    }
    return {
      width: node.measured.width,
      height: node.measured.height,
    };
  });
  
  const updateDimension = (attr: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value);
    
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === '2-3') {
          // Find parent node
          const parentNode = nds.find(node => node.id === '2-1');
          const parentWidth = parentNode && parentNode.style ? parentNode.style.width : Infinity;
          const parentHeight = parentNode && parentNode.style ? parentNode.style.height : Infinity;
          
          // Get current node
          const currentNode = nds.find(node => node.id === '2-3');
          if (!currentNode) return n;
          
          const currentPosX = currentNode.position.x;
          const currentPosY = currentNode.position.y;
  
          const maxWidth = Math.max(Number(parentWidth) - currentPosX, 0);
          const maxHeight = Math.max(Number(parentHeight) - currentPosY, 0);
  
          const newSize = {
            width: attr === 'width' ? Math.min(value, maxWidth) : currentNode.style?.width,
            height: attr === 'height' ? Math.min(value, maxHeight) : currentNode.style?.height,
          };
  
          return {
            ...n,
            style: {
              ...(n.style || {}),
              [attr]: newSize[attr as keyof typeof newSize],
            },
          };
        }
  
        return n;
      }),
    );
  };
  
  
  return (
    <div>
      {dimensionAttrs.map((attr) => (
        <Fragment key={attr}>
          <label>Node {attr}</label>
          <input
            type="number"
            value={dimensions ? parseInt(String(dimensions[attr as keyof typeof dimensions])) : 0}
            onChange={updateDimension(attr)}
            className="text-input-node__input nodrag"
            disabled={!dimensions}
          />
        </Fragment>
      ))}
      <Handle type="target" position={Position.Top} className='custom-handle' />
    </div>
  );
});

export default TextInputNode;
