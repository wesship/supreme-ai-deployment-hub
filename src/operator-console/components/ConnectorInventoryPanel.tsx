import type { OperatorConnectors } from '../operatorApi';

export function ConnectorInventoryPanel({
  connectors,
}: {
  connectors: OperatorConnectors;
}) {
  return (
    <div className="operator-card large">
      <div className="operator-label">Connector Inventory</div>
      <div className="operator-value operator-cyan">Connected</div>

      <div style={{ marginTop: 18 }}>
        <Section title="Production" items={connectors.production} />
        <Section title="Staging" items={connectors.staging} />
        <Section title="Future" items={connectors.future} />
      </div>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="operator-label">{title}</div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginTop: 10,
        }}
      >
        {items.map((item) => (
          <div key={item} className="operator-pill">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ConnectorInventoryPanel;
