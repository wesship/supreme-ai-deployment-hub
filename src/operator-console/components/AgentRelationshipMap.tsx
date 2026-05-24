type GraphNode = {
  id: string;
  label: string;
  type: string;
  status: string;
};

type GraphEdge = {
  source: string;
  target: string;
  label: string;
};

export function AgentRelationshipMap({
  nodes,
  edges,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
}) {
  return (
    <div className="operator-card large">
      <div className="operator-label">Agent Relationship Graph</div>
      <div className="operator-value operator-cyan">Connected Mesh</div>

      <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
        {nodes.map((node) => (
          <div key={node.id} className="operator-pill">
            <div style={{ fontWeight: 700 }}>{node.label}</div>
            <div style={{ color: 'var(--operator-muted)', marginTop: 4 }}>
              {node.type} • {node.status}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="operator-label">Relationships</div>

        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          {edges.map((edge, index) => (
            <div key={`${edge.source}-${edge.target}-${index}`} className="operator-pill">
              {edge.source} → {edge.target} • {edge.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AgentRelationshipMap;
