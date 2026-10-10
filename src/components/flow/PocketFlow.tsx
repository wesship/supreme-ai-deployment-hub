
import React, { useCallback } from 'react';
import {
  ReactFlow,
  addEdge,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  Connection,
} from '@xyflow/react';
import { initialNodes, initialEdges } from './initial-elements';
import AnnotationNode from './nodes/AnnotationNode';
import ToolbarNode from './nodes/ToolbarNode';
import ResizerNode from './nodes/ResizerNode';
import CircleNode from './nodes/CircleNode';
import TextInputNode from './nodes/TextInputNode';
import ButtonEdge from './edges/ButtonEdge';

// Import the required styles for ReactFlow
import '@xyflow/react/dist/style.css';
import './flow.css';

const nodeTypes = {
  annotation: AnnotationNode,
  tools: ToolbarNode,
  resizer: ResizerNode,
  circle: CircleNode,
  textinput: TextInputNode,
};

const edgeTypes = {
  button: ButtonEdge,
};

const nodeClassName = (node: any) => node.type;

// Make sure all nodes have the required data property and correct extent type
const typedInitialNodes: Node[] = initialNodes.map(node => ({
  ...node,
  data: node.data || {}, // Ensure data property exists
  // Handle extent property correctly by properly typing it
  extent: node.extent === 'parent' ? 'parent' : undefined
}));

const PocketFlow: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(typedInitialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges as Edge[]);
  
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        attributionPosition="top-right"
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        style={{ backgroundColor: "#F7F9FB" }}
      >
        <MiniMap zoomable pannable nodeClassName={nodeClassName} />
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  );
};

export default PocketFlow;
