type TopologyLayer = {
  name: string;
  status: string;
  components: string[];
};

export function RuntimeTopologyPanel({
  layers,
}: {
  layers: TopologyLayer[];
}) {
  return (
    <div className="operator-card wide">
      <div className="operator-label">Runtime Topology</div>
      <div className="operator-value operator-green">Layered Infrastructure</div>

      <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
        {layers.map((layer) => (
          <div key={layer.name} className="operator-pill">
            <div style={{ fontWeight: 700 }}>
              {layer.name} • {layer.status}
            </div>

            <div style={{ marginTop: 8, color: 'var(--operator-muted)' }}>
              {layer.components.join(' • ')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RuntimeTopologyPanel;
