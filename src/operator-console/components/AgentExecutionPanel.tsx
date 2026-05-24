import { useEffect, useState } from 'react';

import { operatorAuthHeaders } from '../operatorSession';

type Agent = {
  id: string;
  role: string;
  status: string;
  lastEvent: string;
};

type AgentResponse = {
  timestamp: string;
  agents: Agent[];
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

const fallbackAgents: AgentResponse = {
  timestamp: new Date(0).toISOString(),
  agents: [],
};

async function fetchAgents(): Promise<AgentResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/operator/agents`, {
      headers: {
        Accept: 'application/json',
        ...operatorAuthHeaders(),
      },
    });
    if (!response.ok) return fallbackAgents;
    return (await response.json()) as AgentResponse;
  } catch {
    return fallbackAgents;
  }
}

export function AgentExecutionPanel() {
  const [agents, setAgents] = useState<AgentResponse>(fallbackAgents);

  useEffect(() => {
    async function load() {
      setAgents(await fetchAgents());
    }

    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="operator-card wide">
      <div className="operator-label">Agent Execution Mesh</div>
      <div className="operator-value operator-cyan">{agents.agents.length} Agents</div>

      <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
        {agents.agents.length === 0 ? (
          <div className="operator-pill">No agent execution telemetry available yet.</div>
        ) : (
          agents.agents.map((agent) => (
            <div key={agent.id} className="operator-pill">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <strong>{agent.id}</strong>
                <span style={{ color: 'var(--operator-muted)' }}>{agent.status}</span>
              </div>
              <div style={{ marginTop: 6 }}>{agent.role}</div>
              <div style={{ marginTop: 8, color: 'var(--operator-muted)' }}>{agent.lastEvent}</div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 14, color: 'var(--operator-muted)', fontSize: '0.8rem' }}>
        Last agent refresh: {agents.timestamp}
      </div>
    </div>
  );
}

export default AgentExecutionPanel;
