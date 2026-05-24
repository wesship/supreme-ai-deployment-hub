import type { OperatorGraph, OperatorTopology } from '../operatorApi';

export function TopologyVisualizationPanel({
  graph,
  topology,
}: {
  graph: OperatorGraph;
  topology: OperatorTopology;
}) {
  return (
    <div className="operator-card wide">
      <div className="operator-label">Operator Topology</div>
      <div className="operator-value operator-cyan">Systems Map</div>

      <div style={{ marginTop: 10, color: 'var(--operator-muted)' }}>
        Layers: {topology.layers.length} • Nodes: {graph.nodes.length} • Edges: {graph.edges.length} • Integration:{' '}
        {topology.integrationStatus ?? 'unknown'}
      </div>

      <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>
        {topology.layers.length === 0 ? (
          <div className="operator-pill">No topology layers available yet.</div>
        ) : (
          topology.layers.map((layer) => (
            <div key={layer.name} className="operator-pill">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <strong>{layer.name}</strong>
                <span style={{ color: 'var(--operator-muted)' }}>{layer.status}</span>
              </div>
              <div style={{ marginTop: 8, color: 'var(--operator-muted)' }}>
                {layer.components.join(' • ')}
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="operator-label">Relationship Edges</div>
        <div style={{ marginTop: 10, display: 'grid', gap: 8, maxHeight: 260, overflow: 'auto' }}>
          {graph.edges.length === 0 ? (
            <div className="operator-pill">No topology relationships available yet.</div>
          ) : (
            graph.edges.map((edge, index) => (
              <div key={`${edge.source}-${edge.target}-${index}`} className="operator-pill">
                {edge.source} → {edge.target}
                {edge.label ? ` • ${edge.label}` : ''}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default TopologyVisualizationPanel;
