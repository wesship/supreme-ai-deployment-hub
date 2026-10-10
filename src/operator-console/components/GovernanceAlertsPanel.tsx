type Alert = {
  level: string;
  surface: string;
  message: string;
};

export function GovernanceAlertsPanel({ alerts }: { alerts: Alert[] }) {
  return (
    <div className="operator-card wide">
      <div className="operator-label">Governance Alerts</div>
      <div className="operator-value operator-cyan">Review Active</div>

      <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
        {alerts.map((alert, index) => (
          <div key={`${alert.surface}-${index}`} className="operator-pill">
            <div style={{ fontWeight: 700 }}>
              {alert.surface} • {alert.level}
            </div>

            <div style={{ marginTop: 6 }}>{alert.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default GovernanceAlertsPanel;
