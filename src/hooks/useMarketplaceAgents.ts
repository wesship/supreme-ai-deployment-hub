import { useEffect, useState } from 'react';
import type { AgentTemplate } from '@/types/marketplace';

const API_URL = (import.meta.env.VITE_API_URL || 'https://api.d3vonn.io').replace(/\/$/, '');

interface MarketplaceAgentsResponse {
  source: string;
  live: boolean;
  count: number;
  agents: AgentTemplate[];
}

export function useMarketplaceAgents() {
  const [agents, setAgents] = useState<AgentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>('agent_registry');
  const [live, setLive] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/api/marketplace/agents`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Marketplace API returned ${response.status}`);
        }
        const payload = (await response.json()) as MarketplaceAgentsResponse;
        if (!Array.isArray(payload.agents)) {
          throw new Error('Marketplace API returned an invalid catalog');
        }
        setAgents(payload.agents);
        setSource(payload.source || 'agent_registry');
        setLive(Boolean(payload.live));
      } catch (err) {
        if (controller.signal.aborted) return;
        setAgents([]);
        setLive(false);
        setError(err instanceof Error ? err.message : 'Marketplace catalog unavailable');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void load();
    return () => controller.abort();
  }, []);

  return { agents, loading, error, source, live };
}
