type Agent = {
  id: string;
  role: string;
  status: string;
  lastEvent: string;
};

export function AgentExecutionTimeline({ agents }: { agents: Agent[] }) {
  return (
    <div className="operator-card large">
      <div className="operator-label">Agent Activity Mesh</div>
      <div className="operator-value operator-cyan">Live Agents</div>

      <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
        {agents.map((agent) => (
          <div key={agent.id} className="operator-pill">
            <div style={{ fontWeight: 700 }}>{agent.id}</div>
            <div style={{ color: 'var(--operator-muted)', marginTop: 4 }}>
              {agent.role}
            </div>
            <div style={{ marginTop: 8 }}>{agent.lastEvent}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AgentExecutionTimeline;
